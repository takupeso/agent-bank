export function formatUsdc(units: string) {
  const n = BigInt(units);
  const fraction = (n % 1000000n)
    .toString()
    .padStart(6, "0")
    .replace(/0+$/, "");
  return (
    (n / 1000000n).toLocaleString("ja-JP") + (fraction ? "." + fraction : "")
  );
}
