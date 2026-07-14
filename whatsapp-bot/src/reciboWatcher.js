// Escuta a fila de recibos (config Eixo → botão "Enviar por WhatsApp" em Pedidos)
// e envia o PDF de verdade pro cliente via Baileys. getSock() sempre lê o socket
// mais recente — necessário porque o WhatsApp força reconexões e troca o sock
// internamente (mesmo padrão do syncAndReload em index.js).
import PDFDocument from 'pdfkit'
import { FieldValue } from 'firebase-admin/firestore'
import { fileURLToPath } from 'url'

const COL = 'recibosFila'
const LOGO_PATH = fileURLToPath(new URL('../../public/apple-touch-icon.png', import.meta.url))

// Mesma paleta do preview em Eixo (shared/components/Recibo.js) — Verde
// Petróleo pro masthead/rodapé, Esmeralda (escurecido pra contraste em texto)
// pro total e "já pago".
const PETROL       = '#123c43'
const PETROL_LIGHT = '#a9c2c6'
const EMERALD      = '#6fb8ae'
const EMERALD_TXT  = '#0b7a53'
const INK          = '#16232a'
const MUTED        = '#6b8087'
const LINE         = '#dce6e8'

const PAGE_W    = 595.28 // A4 em pt
const MARGIN    = 40
const CONTENT_W = PAGE_W - MARGIN * 2

export function watchRecibosFila(getSock, db) {
  db.collection(COL).where('status', '==', 'pendente').onSnapshot(snap => {
    snap.docChanges().forEach(change => {
      if (change.type !== 'added') return
      const sock = getSock()
      if (!sock) {
        console.error(`[recibo] fila ${change.doc.id} chegou sem conexão ativa com o WhatsApp — será reprocessada na próxima mudança.`)
        return
      }
      processarRecibo(sock, change.doc).catch(err => {
        console.error('[recibo] erro inesperado ao processar:', err)
      })
    })
  }, err => {
    console.error('[recibo] erro no listener da fila:', err)
  })
}

async function processarRecibo(sock, doc) {
  const data = doc.data()
  console.log(`[recibo] enviando recibo ${data.numero} para ${data.telefone}...`)
  try {
    const pdfBuffer = await gerarPdf(data.dados)
    const jid = `${data.telefone}@s.whatsapp.net`
    await sock.sendMessage(jid, {
      document: pdfBuffer,
      mimetype: 'application/pdf',
      fileName: `recibo-${data.numero}.pdf`,
      caption: `Recibo da sua compra — Venda número ${data.numero}`,
    })
    await doc.ref.update({ status: 'enviado', enviadoEm: FieldValue.serverTimestamp() })
    console.log(`[recibo] ${data.numero} enviado com sucesso.`)
  } catch (err) {
    console.error(`[recibo] falha ao enviar ${data.numero}:`, err)
    await doc.ref.update({
      status:  'erro',
      erro:    String(err?.message || err),
      erroEm:  FieldValue.serverTimestamp(),
    })
  }
}

const brl = v => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

// Escreve um "eyebrow" (rótulo pequeno maiúsculo + régua embaixo) e devolve o y
// onde o conteúdo da seção deve começar.
function eyebrow(doc, texto, x, y, width) {
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(PETROL)
    .text(texto.toUpperCase(), x, y, { width, characterSpacing: 0.6 })
  const ruleY = doc.y + 3
  doc.moveTo(x, ruleY).lineTo(x + width, ruleY).lineWidth(1.2).strokeColor(PETROL).stroke()
  return ruleY + 9
}

function gerarPdf(dados) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4' })
    const chunks = []
    doc.on('data', c => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // ── Masthead (Verde Petróleo, sangria total) ──────────────────────────
    doc.rect(0, 0, PAGE_W, 96).fill(PETROL)
    try { doc.image(LOGO_PATH, MARGIN, 25, { width: 46, height: 46 }) } catch { /* segue sem o selo se o arquivo não existir */ }

    const textX = MARGIN + 46 + 14
    const textW = 260
    doc.font('Times-Bold').fontSize(14).fillColor('#ffffff')
      .text(dados.empresa.fantasia || dados.empresa.razao || '', textX, 22, { width: textW })
    doc.font('Helvetica').fontSize(8.5).fillColor(PETROL_LIGHT)
    let ly = doc.y + 2
    ;[
      ...dados.empresa.enderecoLinhas,
      dados.empresa.tel1 ? `${dados.empresa.tel1} (whatsapp)` : null,
      dados.empresa.tel2,
      dados.empresa.cnpj ? `CNPJ ${dados.empresa.cnpj}` : null,
    ].filter(Boolean).forEach(l => { doc.text(l, textX, ly, { width: textW }); ly = doc.y })

    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(EMERALD)
      .text('RECIBO', MARGIN, 30, { width: CONTENT_W, align: 'right', characterSpacing: 1 })
    doc.font('Times-Bold').fontSize(18).fillColor('#ffffff')
      .text(`Nº ${dados.numero}`, MARGIN, 44, { width: CONTENT_W, align: 'right' })

    // ── Corpo ──────────────────────────────────────────────────────────────
    doc.fillColor(INK)
    const col1X = MARGIN, col1W = 300
    const col2X = MARGIN + col1W + 20, col2W = CONTENT_W - col1W - 20
    let yTop = 128

    const y1 = eyebrow(doc, 'Faturado para', col1X, yTop, col1W)
    doc.font('Helvetica').fontSize(10).fillColor(INK).text(dados.cliente.nome, col1X, y1, { width: col1W })
    doc.font('Helvetica').fontSize(9).fillColor(MUTED)
    ;[dados.cliente.telefone, dados.cliente.email, ...dados.cliente.enderecoLinhas].filter(Boolean)
      .forEach(l => doc.text(l, col1X, doc.y + 2, { width: col1W }))
    const yAfterCol1 = doc.y

    const y2 = eyebrow(doc, 'Detalhes', col2X, yTop, col2W)
    doc.font('Helvetica').fontSize(9.5).fillColor(INK)
      .text(`Data: ${dados.data}`, col2X, y2, { width: col2W })
      .text(`Situação: ${dados.situacao}`, col2X, doc.y + 2, { width: col2W })
      .text(`Vendedor: ${dados.vendedor}`, col2X, doc.y + 2, { width: col2W })

    let y = Math.max(yAfterCol1, doc.y) + 22

    // ── Itens ──────────────────────────────────────────────────────────────
    y = eyebrow(doc, 'Itens', MARGIN, y, CONTENT_W)
    const cols = [
      { label: '#',            x: MARGIN,       w: 20,  align: 'left'  },
      { label: 'Descrição',    x: MARGIN + 24,  w: 240, align: 'left'  },
      { label: 'Preço unit.',  x: MARGIN + 268, w: 70,  align: 'right' },
      { label: 'Qtd.',         x: MARGIN + 342, w: 30,  align: 'right' },
      { label: 'Desconto',     x: MARGIN + 376, w: 65,  align: 'right' },
      { label: 'Total',        x: MARGIN + 445, w: 70,  align: 'right' },
    ]
    doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED)
    cols.forEach(c => doc.text(c.label.toUpperCase(), c.x, y, { width: c.w, align: c.align, characterSpacing: 0.4 }))
    y = doc.y + 5
    doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_W, y).lineWidth(1.2).strokeColor(PETROL).stroke()
    y += 8

    doc.font('Helvetica').fontSize(9.5).fillColor(INK)
    dados.itens.forEach((it, i) => {
      const vals = [String(i + 1), it.descricao, brl(it.precoUnit), String(it.quant), brl(it.desconto), brl(it.total)]
      const rowStartY = y
      cols.forEach((c, ci) => doc.text(vals[ci], c.x, rowStartY, { width: c.w, align: c.align }))
      y = doc.y + 7
      doc.moveTo(MARGIN, y - 3).lineTo(MARGIN + CONTENT_W, y - 3).lineWidth(0.5).strokeColor(LINE).stroke()
    })

    y += 4
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(MUTED)
      .text('TOTAL', MARGIN, y, { width: CONTENT_W - 90, align: 'right', characterSpacing: 0.5 })
    doc.font('Times-Bold').fontSize(15).fillColor(EMERALD_TXT)
      .text(brl(dados.totalValor), MARGIN, y - 3, { width: CONTENT_W, align: 'right' })
    y = doc.y + 22

    // ── Pagamento ──────────────────────────────────────────────────────────
    y = eyebrow(doc, 'Pagamento', MARGIN, y, CONTENT_W)
    doc.font('Helvetica').fontSize(9.5).fillColor(INK)
    dados.financeiro.forEach(f => {
      doc.text(`${f.numParcela}   ${brl(f.valor)}   ${f.dataPgto}   ${f.formaPagamento}   ${f.situacao}`, MARGIN, y, { width: CONTENT_W })
      y = doc.y + 4
    })
    y += 14

    // ── Observações ───────────────────────────────────────────────────────
    if (dados.observacoes) {
      const obsY = y
      const obsLines = doc.font('Helvetica').fontSize(9.5).heightOfString(dados.observacoes, { width: CONTENT_W - 34 })
      const boxH = obsLines + 26
      doc.rect(MARGIN, obsY, CONTENT_W, boxH).fill('#f4f8f8')
      doc.rect(MARGIN, obsY, 3, boxH).fill('#10b981')
      doc.font('Helvetica-Bold').fontSize(8).fillColor(PETROL)
        .text('OBSERVAÇÕES', MARGIN + 18, obsY + 10, { width: CONTENT_W - 34, characterSpacing: 0.5 })
      doc.font('Helvetica').fontSize(9.5).fillColor('#33474c')
        .text(dados.observacoes, MARGIN + 18, doc.y + 3, { width: CONTENT_W - 34 })
      y = obsY + boxH + 16
    }

    // ── Rodapé ────────────────────────────────────────────────────────────
    const footerY = 792 - 40 // A4 = 841.89pt de altura; deixa 40pt de respiro embaixo
    doc.moveTo(MARGIN, footerY).lineTo(MARGIN + CONTENT_W, footerY).lineWidth(0.5).strokeColor(LINE).stroke()
    try { doc.image(LOGO_PATH, MARGIN, footerY + 10, { width: 14, height: 14 }) } catch { /* ok sem selo */ }
    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED)
      .text('Emitido pelo Eixo — uma plataforma Baruk Technology & Consulting.', MARGIN + 20, footerY + 12, { width: CONTENT_W - 20 })

    doc.end()
  })
}
