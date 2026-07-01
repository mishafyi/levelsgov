const payFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const numFmt = new Intl.NumberFormat("en-US");

export function formatPay(n: number): string {
  return payFmt.format(n);
}

export function formatNumber(n: number): string {
  return numFmt.format(n);
}
