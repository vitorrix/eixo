// Escuta a fila de recibos (config Eixo → botão "Enviar por WhatsApp" em Pedidos)
// e envia o PDF de verdade pro cliente via Baileys. getSock() sempre lê o socket
// mais recente — necessário porque o WhatsApp força reconexões e troca o sock
// internamente (mesmo padrão do syncAndReload em index.js).
import PDFDocument from 'pdfkit'
import { FieldValue } from 'firebase-admin/firestore'

const COL = 'recibosFila'

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

function gerarPdf(dados) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' })
    const chunks = []
    doc.on('data', c => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const brl = v => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

    // Cabeçalho
    doc.fontSize(18).text(`Venda número ${dados.numero}`, { align: 'right' })
    doc.moveUp(1.6)
    doc.fontSize(11).text(dados.empresa.fantasia || dados.empresa.razao || '')
    doc.fontSize(9).fillColor('#444')
    dados.empresa.enderecoLinhas.forEach(l => doc.text(l))
    if (dados.empresa.tel1) doc.text(`${dados.empresa.tel1} (whatsapp)`)
    if (dados.empresa.tel2) doc.text(dados.empresa.tel2)
    if (dados.empresa.cnpj) doc.text(`CNPJ: ${dados.empresa.cnpj}`)
    doc.fillColor('#000')
    doc.moveDown()
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke()
    doc.moveDown()

    // Dados da venda
    doc.fontSize(11).text('DADOS DA VENDA', { underline: true })
    doc.fontSize(9.5)
    doc.text(`Cliente: ${dados.cliente.nome}`)
    if (dados.cliente.telefone) doc.text(`Telefone: ${dados.cliente.telefone}`)
    if (dados.cliente.email) doc.text(`E-mail: ${dados.cliente.email}`)
    dados.cliente.enderecoLinhas.forEach((l, i) => doc.text(i === 0 ? `Endereço: ${l}` : l))
    doc.moveDown(0.3)
    doc.text(`Data: ${dados.data}    Situação: ${dados.situacao}    Vendedor: ${dados.vendedor}`)
    doc.moveDown()

    // Itens
    doc.fontSize(11).text('ITENS DA VENDA', { underline: true })
    doc.fontSize(9.5)
    dados.itens.forEach((it, i) => {
      doc.text(`${i + 1}. ${it.descricao}   ${brl(it.precoUnit)} x ${it.quant}   desc. ${brl(it.desconto)}   total ${brl(it.total)}`)
    })
    doc.moveDown(0.3)
    doc.font('Helvetica-Bold').text(`TOTAL (${dados.totalItens} itens): ${brl(dados.totalValor)}`, { align: 'right' })
    doc.font('Helvetica')
    doc.moveDown()

    // Financeiro
    doc.fontSize(11).text('FINANCEIRO', { underline: true })
    doc.fontSize(9.5)
    dados.financeiro.forEach(f => {
      doc.text(`${f.numParcela}   ${brl(f.valor)}   ${f.dataPgto}   ${f.formaPagamento}   ${f.situacao}`)
    })
    doc.moveDown()

    if (dados.observacoes) {
      doc.fontSize(11).text('OBSERVAÇÕES GERAIS', { underline: true })
      doc.fontSize(9.5).text(dados.observacoes)
    }

    doc.end()
  })
}
