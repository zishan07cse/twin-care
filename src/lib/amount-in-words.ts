// Amount-in-words helpers for BDT invoices (English + Bengali, Indian numbering system).
const enOnes = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const enTens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return enOnes[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return enTens[t] + (o ? " " + enOnes[o] : "");
}
function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return (h ? enOnes[h] + " Hundred" + (r ? " " : "") : "") + (r ? twoDigits(r) : "");
}

function integerToWordsEn(n: number): string {
  if (n === 0) return "Zero";
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const rest = n;
  const parts: string[] = [];
  if (crore) parts.push(threeDigits(crore) + " Crore");
  if (lakh) parts.push(twoDigits(lakh) + " Lakh");
  if (thousand) parts.push(twoDigits(thousand) + " Thousand");
  if (rest) parts.push(threeDigits(rest));
  return parts.join(" ").trim();
}

export function amountInWordsEn(amount: number): string {
  const taka = Math.floor(amount);
  const paisa = Math.round((amount - taka) * 100);
  const takaWords = integerToWordsEn(taka) + " Taka";
  return paisa > 0 ? `${takaWords} and ${twoDigits(paisa)} Paisa Only` : `${takaWords} Only`;
}

const bnOnes = [
  "", "এক", "দুই", "তিন", "চার", "পাঁচ", "ছয়", "সাত", "আট", "নয়",
  "দশ", "এগারো", "বারো", "তেরো", "চৌদ্দ", "পনেরো", "ষোল", "সতেরো", "আঠারো", "উনিশ",
  "বিশ", "একুশ", "বাইশ", "তেইশ", "চব্বিশ", "পঁচিশ", "ছাব্বিশ", "সাতাশ", "আটাশ", "ঊনত্রিশ",
  "ত্রিশ", "একত্রিশ", "বত্রিশ", "তেত্রিশ", "চৌত্রিশ", "পঁয়ত্রিশ", "ছত্রিশ", "সাঁইত্রিশ", "আটত্রিশ", "ঊনচল্লিশ",
  "চল্লিশ", "একচল্লিশ", "বিয়াল্লিশ", "তেতাল্লিশ", "চুয়াল্লিশ", "পঁয়তাল্লিশ", "ছেচল্লিশ", "সাতচল্লিশ", "আটচল্লিশ", "ঊনপঞ্চাশ",
  "পঞ্চাশ", "একান্ন", "বায়ান্ন", "তিপ্পান্ন", "চুয়ান্ন", "পঞ্চান্ন", "ছাপ্পান্ন", "সাতান্ন", "আটান্ন", "ঊনষাট",
  "ষাট", "একষট্টি", "বাষট্টি", "তেষট্টি", "চৌষট্টি", "পঁয়ষট্টি", "ছেষট্টি", "সাতষট্টি", "আটষট্টি", "ঊনসত্তর",
  "সত্তর", "একাত্তর", "বাহাত্তর", "তিয়াত্তর", "চুয়াত্তর", "পঁচাত্তর", "ছিয়াত্তর", "সাতাত্তর", "আটাত্তর", "ঊনআশি",
  "আশি", "একাশি", "বিরাশি", "তিরাশি", "চুরাশি", "পঁচাশি", "ছিয়াশি", "সাতাশি", "আটাশি", "উননব্বই",
  "নব্বই", "একানব্বই", "বিরানব্বই", "তিরানব্বই", "চুরানব্বই", "পঁচানব্বই", "ছিয়ানব্বই", "সাতানব্বই", "আটানব্বই", "নিরানব্বই",
];

function bnTwoDigits(n: number): string {
  return bnOnes[n];
}
function bnThreeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return (h ? bnOnes[h] + " শত" + (r ? " " : "") : "") + (r ? bnTwoDigits(r) : "");
}

function integerToWordsBn(n: number): string {
  if (n === 0) return "শূন্য";
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const rest = n;
  const parts: string[] = [];
  if (crore) parts.push(bnThreeDigits(crore) + " কোটি");
  if (lakh) parts.push(bnTwoDigits(lakh) + " লক্ষ");
  if (thousand) parts.push(bnTwoDigits(thousand) + " হাজার");
  if (rest) parts.push(bnThreeDigits(rest));
  return parts.join(" ").trim();
}

export function amountInWordsBn(amount: number): string {
  const taka = Math.floor(amount);
  const paisa = Math.round((amount - taka) * 100);
  const takaWords = integerToWordsBn(taka) + " টাকা";
  return paisa > 0 ? `${takaWords} ${bnTwoDigits(paisa)} পয়সা মাত্র` : `${takaWords} মাত্র`;
}
