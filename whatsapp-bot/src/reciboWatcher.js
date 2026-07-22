// Escuta a fila de recibos (config Eixo → botão "Enviar por WhatsApp" em Pedidos)
// e envia o PDF de verdade pro cliente via Baileys. getSock() sempre lê o socket
// mais recente — necessário porque o WhatsApp força reconexões e troca o sock
// internamente (mesmo padrão do syncAndReload em index.js).
import PDFDocument from 'pdfkit'
import { FieldValue } from 'firebase-admin/firestore'
import { fileURLToPath } from 'url'

const COL = 'recibosFila'
const GOOGLE_REVIEW_URL = 'https://g.co/kgs/L7iwqtP'
// Logo da Baruk (empresa que usa o Eixo) no cabeçalho — selo do Eixo (compass)
// só no rodapé, creditando a plataforma. Mesma regra do preview no app.
const BARUK_LOGO_PATH = fileURLToPath(new URL('../../public/logo-baruk.png', import.meta.url))
const EIXO_MARK_PATH  = fileURLToPath(new URL('../../public/apple-touch-icon.png', import.meta.url))
const BARUK_LOGO_RATIO = 370 / 132 // largura/altura do arquivo public/logo-baruk.png

// Mesma paleta clara do preview em Eixo (shared/components/Recibo.js).
const PETROL     = '#123c43'
const EMERALD_TXT = '#0b7a53'
const INK        = '#1a1a1a'
const MUTED      = '#6b7280'
const LINE       = '#e2e6e7'
const TABLE_BG   = '#f3f5f5'

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

const primeiroNome = nomeCompleto => (nomeCompleto || '').trim().split(/\s+/)[0] || 'Olá'

const mensagemAvaliacao = nome => `${nome}, foi um prazer realizar essa conquista com você.

Queremos te pedir um pequeno favor: sua opinião é muito importante para nós e ajuda outras pessoas a confiarem no nosso trabalho. Você pode deixar uma avaliação sobre sua experiência conosco no Google?

⭐⭐⭐⭐⭐
${GOOGLE_REVIEW_URL}

Se precisar de qualquer coisa, estamos sempre aqui para ajudar.

• Equipe Baruk Store 🍎`

async function processarRecibo(sock, doc) {
  const data = doc.data()
  console.log(`[recibo] enviando recibo ${data.numero} para ${data.telefone}...`)
  try {
    const pdfBuffer = await gerarPdf(data.dados)
    const jid = `${data.telefone}@s.whatsapp.net`
    const nome = data.dados?.cliente?.nome || ''
    const nome1 = primeiroNome(nome)
    const nomeArquivo = nome.replace(/[\\/]/g, '-')
    await sock.sendMessage(jid, {
      document: pdfBuffer,
      mimetype: 'application/pdf',
      fileName: `Recibo de compra Nº ${data.numero}${nomeArquivo ? ` - ${nomeArquivo}` : ''}.pdf`,
      caption: `${nome1}, segue seu recibo.`,
    })
    await sock.sendMessage(jid, { text: mensagemAvaliacao(nome1) })
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

// Escreve um "eyebrow" (rótulo pequeno maiúsculo + régua fina embaixo) e
// devolve o y onde o conteúdo da seção deve começar.
function eyebrow(doc, texto, x, y, width) {
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(PETROL)
    .text(texto.toUpperCase(), x, y, { width, characterSpacing: 0.6 })
  const ruleY = doc.y + 3
  doc.moveTo(x, ruleY).lineTo(x + width, ruleY).lineWidth(0.75).strokeColor(LINE).stroke()
  return ruleY + 9
}

function gerarPdf(dados) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4' })
    const chunks = []
    doc.on('data', c => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // ── Masthead (branco, logo de verdade da Baruk) ───────────────────────
    const logoH = 32, logoW = logoH * BARUK_LOGO_RATIO
    try { doc.image(BARUK_LOGO_PATH, MARGIN, 26, { height: logoH }) } catch { /* segue sem o logo se o arquivo não existir */ }

    const textX = MARGIN
    const textW = 300
    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED)
    let ly = 26 + logoH + 10
    ;[
      ...dados.empresa.enderecoLinhas,
      dados.empresa.tel1 ? `${dados.empresa.tel1} (whatsapp)` : null,
      dados.empresa.tel2,
      dados.empresa.cnpj ? `CNPJ ${dados.empresa.cnpj}` : null,
    ].filter(Boolean).forEach(l => { doc.text(l, textX, ly, { width: textW }); ly = doc.y + 1 })

    doc.font('Helvetica-Bold').fontSize(9).fillColor('#8a9297')
      .text('RECIBO', MARGIN, 28, { width: CONTENT_W, align: 'right', characterSpacing: 1 })
    doc.font('Helvetica-Bold').fontSize(19).fillColor(PETROL)
      .text(`Nº ${dados.numero}`, MARGIN, 42, { width: CONTENT_W, align: 'right' })

    const mastheadBottom = Math.max(ly, 26 + logoH) + 14
    doc.moveTo(MARGIN, mastheadBottom).lineTo(MARGIN + CONTENT_W, mastheadBottom).lineWidth(2).strokeColor(PETROL).stroke()

    // ── Corpo ──────────────────────────────────────────────────────────────
    doc.fillColor(INK)
    const col1X = MARGIN, col1W = 300
    const col2X = MARGIN + col1W + 20, col2W = CONTENT_W - col1W - 20
    let yTop = mastheadBottom + 20

    const y1 = eyebrow(doc, 'Faturado para', col1X, yTop, col1W)
    doc.font('Helvetica').fontSize(10).fillColor(INK).text(dados.cliente.nome, col1X, y1, { width: col1W })
    doc.font('Helvetica').fontSize(9).fillColor(MUTED)
    ;[dados.cliente.telefone, dados.cliente.email, ...dados.cliente.enderecoLinhas].filter(Boolean)
      .forEach(l => doc.text(l, col1X, doc.y + 2, { width: col1W }))
    const yAfterCol1 = doc.y

    const y2 = eyebrow(doc, 'Detalhes', col2X, yTop, col2W)
    doc.font('Helvetica').fontSize(9.5).fillColor(INK)
      .text(`Data: ${dados.data}`, col2X, y2, { width: col2W })

    let y = Math.max(yAfterCol1, doc.y) + 22

    // ── Itens (formato de tabela, cabeçalho e total com fundo leve) ────────
    y = eyebrow(doc, 'Itens', MARGIN, y, CONTENT_W)
    const cols = [
      { label: '#',            x: MARGIN,       w: 20,  align: 'left'  },
      { label: 'Descrição',    x: MARGIN + 24,  w: 240, align: 'left'  },
      { label: 'Preço unit.',  x: MARGIN + 268, w: 70,  align: 'right' },
      { label: 'Qtd.',         x: MARGIN + 342, w: 30,  align: 'right' },
      { label: 'Desconto',     x: MARGIN + 376, w: 65,  align: 'right' },
      { label: 'Total',        x: MARGIN + 445, w: 70,  align: 'right' },
    ]
    doc.rect(MARGIN, y, CONTENT_W, 20).fill(TABLE_BG)
    doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED)
    cols.forEach(c => doc.text(c.label.toUpperCase(), c.x, y + 6, { width: c.w, align: c.align, characterSpacing: 0.4 }))
    y += 24

    doc.font('Helvetica').fontSize(9.5).fillColor(INK)
    dados.itens.forEach((it, i) => {
      const vals = [String(i + 1), it.descricao, brl(it.precoUnit), String(it.quant), brl(it.desconto), brl(it.total)]
      const rowStartY = y
      cols.forEach((c, ci) => doc.text(vals[ci], c.x, rowStartY, { width: c.w, align: c.align }))
      y = doc.y + 7
      doc.moveTo(MARGIN, y - 3).lineTo(MARGIN + CONTENT_W, y - 3).lineWidth(0.5).strokeColor(LINE).stroke()
    })

    const totalQtd      = dados.itens.reduce((s, i) => s + (Number(i.quant) || 0), 0)
    const totalDesconto = dados.itens.reduce((s, i) => s + (Number(i.desconto) || 0), 0)
    doc.rect(MARGIN, y, CONTENT_W, 22).fill(TABLE_BG)
    doc.font('Helvetica-Bold').fontSize(9)
    doc.fillColor('#374151').text('TOTAL', cols[1].x, y + 6, { width: cols[1].w, align: 'left', characterSpacing: 0.4 })
    doc.fillColor('#374151').text(String(totalQtd), cols[3].x, y + 6, { width: cols[3].w, align: 'right' })
    doc.fillColor('#374151').text(brl(totalDesconto), cols[4].x, y + 6, { width: cols[4].w, align: 'right' })
    doc.fillColor(EMERALD_TXT).fontSize(10.5).text(brl(dados.totalValor), cols[5].x, y + 5, { width: cols[5].w, align: 'right' })
    y += 42

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
    try { doc.image(EIXO_MARK_PATH, MARGIN, footerY + 10, { width: 14, height: 14 }) } catch { /* ok sem selo */ }
    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED)
      .text('Emitido pelo Eixo — uma plataforma Baruk Technology & Consulting.', MARGIN + 20, footerY + 12, { width: CONTENT_W - 20 })

    doc.end()
  })
}
