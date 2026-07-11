// Tabela fixa de cores Apple -> nome em português usado para exibição no Eixo.
// Chave em minúsculo e sem acento pra casar com qualquer variação que os
// fornecedores escrevem (inglês, português, com/sem espaço).
//
// O bloco "Modelos consolidados" vem das planilhas oficiais (cores_apple_simplificadas.xlsx
// + novas_cores_apple_simplificadas.xlsx, 2026-07) cruzando iPhone/iPad/MacBook/Watch/
// AirPods/iMac/Mac mini/Mac Studio/Mac Pro/AirTag/Pencil/Magic Mouse/Magic Keyboard —
// 29 termos em inglês, verificados sem conflito entre os dois arquivos. Ao contrário da
// versão anterior desta tabela, cores de marketing distintas NÃO são mais fundidas numa
// cor-base (ex: Sálvia e Ultramarino ficam com nome próprio, não viram "Verde"/"Azul";
// Branco e Prateado também não são mais a mesma cor) — segue exatamente o que a
// planilha define pra cada modelo. Descritores como "Titânio"/"Espacial"/"(PRODUCT)"
// foram removidos por decisão do usuário (ver abas "Observações" das planilhas).
const COLOR_TABLE = {
  // Básicas
  'preto': 'Preto', 'black': 'Preto',
  'branco': 'Branco', 'white': 'Branco',
  'azul': 'Azul', 'blue': 'Azul',
  'verde': 'Verde', 'green': 'Verde',
  'amarelo': 'Amarelo', 'yellow': 'Amarelo',
  'rosa': 'Rosa', 'pink': 'Rosa', 'rosa suave': 'Rosa', 'soft pink': 'Rosa',
  'roxo': 'Roxo', 'purple': 'Roxo', 'lilas': 'Roxo', 'lilás': 'Roxo',
  'vermelho': 'Vermelho', 'red': 'Vermelho', 'product red': 'Vermelho', '(product)red': 'Vermelho',
  'laranja': 'Laranja', 'orange': 'Laranja',
  'dourado': 'Dourado', 'gold': 'Dourado',
  'cinza': 'Cinza', 'gray': 'Cinza', 'grey': 'Cinza',
  'grafite': 'Grafite', 'graphite': 'Grafite',

  // Acabamentos de marketing sem cobertura nas planilhas oficiais — mantidos
  // fundidos na cor básica mais próxima (fallback, não vem de fonte oficial).
  'sierra blue': 'Azul', 'pacific blue': 'Azul', 'deep blue': 'Azul', 'mist blue': 'Azul',
  'alpine green': 'Verde',
  'deep purple': 'Roxo',
  'cosmic orange': 'Laranja',
  'azul-profundo': 'Azul', 'azul-serra': 'Azul', 'azul-pacifico': 'Azul', 'azul-pacífico': 'Azul',
  'azul-nevoa': 'Azul', 'azul-névoa': 'Azul', 'verde-azulado': 'Azul',
  'verde-alpino': 'Verde',
  'roxo-profundo': 'Roxo',
  'laranja-cosmico': 'Laranja', 'laranja-cósmico': 'Laranja',
  'space gray': 'Cinza espacial', 'space grey': 'Cinza espacial', 'cinza espacial': 'Cinza espacial',
  'space black': 'Preto espacial', 'preto espacial': 'Preto espacial',
  'space black (pro chip)': 'Preto espacial',
  'carbon natural': 'Carbono Natural',

  // Watch / Ultra / bandas — sem cobertura nas planilhas oficiais.
  'rose': 'Rosé',
  'ocean': 'Ocean Band', 'ocean band': 'Ocean Band', 'black ocean': 'Ocean Band Preto', 'black ocean band': 'Ocean Band Preto',
  'blue black': 'Azul e Preto', 'orange beige': 'Laranja e Bege', 'green gray': 'Verde e Cinza', 'greengray': 'Verde e Cinza',
  'espresso': 'Espresso',

  // Sem cor definida
  'sem cor': '', '': '',

  // Modelos consolidados — planilhas oficiais (fonte da verdade, sobrescreve
  // qualquer entrada acima com a mesma chave).
  'laranja': 'Laranja', 'orange': 'Laranja',
  'azul': 'Azul', 'blue': 'Azul',
  'prateado': 'Prateado', 'prata': 'Prateado', 'silver': 'Prateado',
  'preto': 'Preto', 'black': 'Preto',
  'branco': 'Branco', 'white': 'Branco',
  'dourado': 'Dourado', 'gold': 'Dourado',
  'azul céu': 'Azul céu', 'azul-céu': 'Azul céu', 'sky blue': 'Azul céu', 'sky': 'Azul céu', 'skyblue': 'Azul céu',
  'rosa': 'Rosa', 'pink': 'Rosa',
  'sálvia': 'Sálvia', 'salvia': 'Sálvia', 'sage': 'Sálvia',
  'lavanda': 'Lavanda', 'lavender': 'Lavanda', 'lavander': 'Lavanda',
  'natural': 'Natural',
  'deserto': 'Deserto', 'desert': 'Deserto',
  'teal': 'Verde',
  'ultramarino': 'Ultramarino', 'ultramarine': 'Ultramarino', 'ultramarina': 'Ultramarino',
  'amarelo': 'Amarelo', 'yellow': 'Amarelo',
  'roxo': 'Roxo', 'purple': 'Roxo',
  'meia noite': 'Meia noite', 'meia-noite': 'Meia noite', 'midnight': 'Meia noite',
  'verde meia noite': 'Verde meia noite', 'midnight green': 'Verde meia noite',
  'estelar': 'Estelar', 'starlight': 'Estelar',
  'vermelho': 'Vermelho', 'red': 'Vermelho',
  'grafite': 'Grafite', 'graphite': 'Grafite',
  'cinza': 'Cinza', 'gray': 'Cinza', 'grey': 'Cinza',
  'blush': 'Blush',
  'cítrico': 'Cítrico', 'citrico': 'Cítrico', 'citrus': 'Cítrico',
  'índigo': 'Índigo', 'indigo': 'Índigo',
  'ouro rosa': 'Ouro rosa', 'rose gold': 'Ouro rosa',
  'preto brilhante': 'Preto brilhante', 'jet black': 'Preto brilhante',
  'ardósia': 'Ardósia', 'ardosia': 'Ardósia', 'slate': 'Ardósia',

  // Titânio (iPhone Pro) — a planilha remove o descritor "Titânio", o acabamento
  // vira a cor-base (ex: "Natural Titanium" -> "Natural", não "Titânio Natural").
  'natural titanium': 'Natural', 'titanio natural': 'Natural', 'titânio natural': 'Natural',
  'blue titanium': 'Azul',
  'white titanium': 'Branco',
  'black titanium': 'Preto',
  'desert titanium': 'Deserto',
}

function stripAccents(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// Recebe a cor bruta extraída pela IA e devolve o nome canônico em português.
// Se não encontrar na tabela, devolve o texto original (capitalizado), pra nunca perder a informação.
export function normalizeColor(raw) {
  if (!raw) return ''
  const key = stripAccents(raw.trim().toLowerCase())
  if (key in COLOR_TABLE) return COLOR_TABLE[key]
  return raw.trim()
}
