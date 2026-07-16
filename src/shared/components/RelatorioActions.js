import { el } from '../utils/dom.js'

// Barra de ações no rodapé dos Relatórios. Mesma convenção do recibo: o
// diálogo nativo de impressão já oferece "Salvar como PDF" como impressora,
// então um botão só cobre imprimir e exportar PDF sem gerar o arquivo de novo
// no cliente. O CSS @media print (global.css) esconde a navegação e imprime
// só o conteúdo do relatório, com o cabeçalho da empresa.
export function createRelatorioActions({ onBeforePrint } = {}) {
  const printBtn = el('button', { type: 'button', class: 'btn btn-outline' }, '🖨️ Imprimir / PDF')
  printBtn.addEventListener('click', () => {
    onBeforePrint?.()
    window.print()
  })

  return el('div', { class: 'relatorio-actions no-print' }, printBtn)
}
