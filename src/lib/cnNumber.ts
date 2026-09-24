/**
 * 中文数字 / 语音文本归一化。
 * 语音常说"二百三十五块九毛二"，旧正则只认阿拉伯数字就会瞎——
 * 先把中文数字转成阿拉伯数字再做意图解析。
 * 纯函数，无依赖，方便单测。
 */

const CN_DIGITS: Record<string, number> = {
  零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5,
  六: 6, 七: 7, 八: 8, 九: 9, 两: 2, 俩: 2,
};
const CN_SMALL_UNIT: Record<string, number> = { 十: 10, 百: 100, 千: 1000 };
const CN_BIG_UNIT: Record<string, number> = { 万: 10000, 亿: 100000000 };

/** 中文整数 -> 数字（"二百三十五" -> 235，"十二" -> 12） */
export function cnIntToNum(s: string): number {
  let total = 0;
  let section = 0;
  let num = 0;
  let hasDigit = false;
  for (const ch of s) {
    if (ch in CN_DIGITS) {
      num = CN_DIGITS[ch];
      hasDigit = true;
    } else if (ch in CN_SMALL_UNIT) {
      section += (hasDigit ? num : 1) * CN_SMALL_UNIT[ch];
      num = 0;
      hasDigit = false;
    } else if (ch in CN_BIG_UNIT) {
      total += (section + (hasDigit ? num : 0)) * CN_BIG_UNIT[ch];
      section = 0;
      num = 0;
      hasDigit = false;
    }
  }
  return total + section + (hasDigit ? num : 0);
}

/** 中文数字串（含"点"小数） -> 阿拉伯数字字符串（"二百二十七点九二" -> "227.92"） */
export function cnNumToArabic(s: string): string {
  const dot = s.indexOf('点');
  if (dot >= 0) {
    const intPart = cnIntToNum(s.slice(0, dot));
    const frac = s
      .slice(dot + 1)
      .split('')
      .map((ch) => (ch in CN_DIGITS ? String(CN_DIGITS[ch]) : ''))
      .join('');
    return frac ? `${intPart}.${frac}` : String(intPart);
  }
  if (!/[十百千万亿]/.test(s)) {
    // 无单位的裸字连写都是逐位读数："九五"->95、"二零二四"->2024
    // （规范中文里 95 只会说"九十五"，不会把九五连写成一个数）
    return s
      .split('')
      .map((ch) => (ch in CN_DIGITS ? String(CN_DIGITS[ch]) : ''))
      .join('');
  }
  return String(cnIntToNum(s));
}

const CN_NUM_RE = /[零一二三四五六七八九两俩十百千万亿]+(?:点[零一二三四五六七八九两俩]+)?/g;

/**
 * 语音/输入文本归一化：
 * 1) 全角字符转半角（２２７．９２ -> 227.92）
 * 2) 中文数字转阿拉伯数字（"二百三十五块" -> "235块"）
 * 3) 字母代码里的空格去掉（语音常把 IBM 念成 "I B M"）
 */
export function normalizeSpeechText(text: string): string {
  let t = text.replace(
    /[Ａ-Ｚａ-ｚ０-９．：，；？！（）＠]/g,
    (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );
  t = t.replace(CN_NUM_RE, (m) => cnNumToArabic(m));
  t = t.replace(/\b([A-Za-z](?:\s+[A-Za-z])+)\b/g, (m) => m.replace(/\s+/g, ''));
  return t;
}
