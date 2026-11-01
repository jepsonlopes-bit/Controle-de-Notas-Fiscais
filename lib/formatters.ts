/**
 * Utilitários de formatação e manipulação no padrão brasileiro (pt-BR)
 */

export function formatarMoeda(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || isNaN(Number(valor))) {
    return 'R$ 0,00';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(valor));
}

export function formatarDataBR(dataIso: string | null | undefined): string {
  if (!dataIso) return '-';
  try {
    const limpo = dataIso.split('T')[0];
    const partes = limpo.split('-');
    if (partes.length === 3) {
      const [ano, mes, dia] = partes;
      return `${dia.padStart(2, '0')}/${mes.padStart(2, '0')}/${ano}`;
    }
    return dataIso;
  } catch {
    return dataIso;
  }
}

export function formatarDataHoraBR(isoTimestamp: string | null | undefined): string {
  if (!isoTimestamp) return '-';
  try {
    const data = new Date(isoTimestamp);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(data);
  } catch {
    return isoTimestamp;
  }
}

/**
 * Converte valores monetários flexíveis em número decimal (Float)
 * Suporta: "1.250,50", "R$ 1.250,50", "1250.50", "1250,5", 1250.5
 */
export function converterMoedaParaNumero(valor: unknown): number {
  if (typeof valor === 'number') return valor;
  if (!valor) return 0;

  let str = String(valor).trim();
  // Remove "R$", espaços e caracteres não numéricos exceto vírgula, ponto e traço
  str = str.replace(/[R$\s]/gi, '');

  // Se tiver ponto e vírgula (ex: 1.250,50)
  if (str.includes('.') && str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    // Apenas vírgula (ex: 1250,50)
    str = str.replace(',', '.');
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Converte data de planilha ou texto para formato ISO AAAA-MM-DD
 * Suporta formatos:
 * - DD/MM/AAAA ou DD-MM-AAAA
 * - AAAA-MM-DD
 * - Número serial do Excel (ex: 45220)
 */
export function normalizarDataParaISO(valor: unknown): string {
  if (!valor) return '';

  // Se for número serial do Excel (dias desde 30/12/1899)
  if (typeof valor === 'number' || (!isNaN(Number(valor)) && !String(valor).includes('/') && !String(valor).includes('-'))) {
    const num = Number(valor);
    if (num > 1000 && num < 100000) {
      // Ajuste de época Excel (bug do ano bissexto de 1900 no Excel)
      const data = new Date(Math.round((num - 25569) * 86400 * 1000));
      return data.toISOString().split('T')[0];
    }
  }

  const str = String(valor).trim();

  // Se já for ISO: AAAA-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // Se for brasileiro: DD/MM/AAAA ou DD-MM-AAAA
  const matchBR = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (matchBR) {
    const dia = matchBR[1].padStart(2, '0');
    const mes = matchBR[2].padStart(2, '0');
    const ano = matchBR[3];
    return `${ano}-${mes}-${dia}`;
  }

  // Tenta Date() nativo
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch {
    // ignora
  }

  return '';
}

/**
 * Preserva zeros à esquerda para números de documentos (OC, NF, Medição)
 */
export function preservarZerosDocumento(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  return String(valor).trim();
}
