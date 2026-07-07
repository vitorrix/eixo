// Tabela fixa de cores Apple (todas as linhas: iPhone, Watch, iPad, Mac, AirPods,
// Pencil, AirTag) -> nome em português usado para exibição no Eixo. Chave em
// minúsculo e sem acento pra casar com qualquer variação que os fornecedores
// escrevem (inglês, português, com/sem espaço).
const COLOR_TABLE = {
  // Básicas
  'preto': 'Preto', 'black': 'Preto',
  'branco': 'Branco', 'white': 'Branco',
  'azul': 'Azul', 'blue': 'Azul',
  'verde': 'Verde', 'green': 'Verde',
  'amarelo': 'Amarelo', 'yellow': 'Amarelo',
  'rosa': 'Rosa', 'pink': 'Rosa',
  'roxo': 'Roxo', 'purple': 'Roxo', 'lilas': 'Roxo', 'lilás': 'Roxo', 'lavanda': 'Roxo', 'lavender': 'Roxo',
  'vermelho': 'Vermelho', 'red': 'Vermelho', 'product red': '(PRODUCT)RED',
  'laranja': 'Laranja', 'orange': 'Laranja',
  'dourado': 'Dourado', 'gold': 'Dourado',
  'prata': 'Prata', 'silver': 'Prata',
  'cinza': 'Cinza', 'gray': 'Cinza', 'grey': 'Cinza',
  'grafite': 'Grafite', 'graphite': 'Grafite',

  // Acabamentos iPhone
  'space gray': 'Cinza-espacial', 'space grey': 'Cinza-espacial', 'cinza espacial': 'Cinza-espacial', 'cinza-espacial': 'Cinza-espacial',
  'space black': 'Preto-espacial', 'preto espacial': 'Preto-espacial',
  'jet black': 'Preto Brilhante',
  'midnight': 'Meia-noite', 'meia noite': 'Meia-noite', 'meia-noite': 'Meia-noite',
  'starlight': 'Estelar', 'estelar': 'Estelar',
  'sierra blue': 'Azul-serra',
  'pacific blue': 'Azul-pacífico',
  'alpine green': 'Verde-alpino',
  'deep purple': 'Roxo-profundo',
  'deep blue': 'Azul-profundo',
  'mist blue': 'Azul-névoa',
  'cosmic orange': 'Laranja-cósmico',
  'ultramarine': 'Ultramarino', 'ultramarina': 'Ultramarino',
  'teal': 'Verde-azulado',
  'sage': 'Sálvia',

  // Titânio (iPhone Pro)
  'natural titanium': 'Titânio Natural', 'titanio natural': 'Titânio Natural', 'titânio natural': 'Titânio Natural', 'natural': 'Titânio Natural',
  'blue titanium': 'Titânio Azul',
  'white titanium': 'Titânio Branco',
  'black titanium': 'Titânio Preto',
  'desert titanium': 'Titânio Deserto', 'desert': 'Titânio Deserto',

  // Watch / Ultra / bandas
  'rose gold': 'Ouro Rosa',
  'rose': 'Rosé',
  'ocean': 'Ocean Band', 'ocean band': 'Ocean Band', 'black ocean': 'Ocean Band Preto', 'black ocean band': 'Ocean Band Preto',
  'blue black': 'Azul e Preto', 'orange beige': 'Laranja e Bege', 'green gray': 'Verde e Cinza', 'greengray': 'Verde e Cinza',
  'espresso': 'Espresso',

  // Mac / iPad
  'sky blue': 'Azul-céu', 'sky': 'Azul-céu',
  'indigo': 'Índigo',
  'citrus': 'Cítrico',
  'blush': 'Blush',
  'carbon natural': 'Carbono Natural',
  'space black (pro chip)': 'Preto-espacial',

  // Sem cor definida
  'sem cor': '', '': '',
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
