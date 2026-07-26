export function parseSalesCsv(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [date, quantity] = line.split(',').map((value) => value.trim());
      return { date, quantity_sold: Number(quantity) };
    })
    .filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date) && Number.isFinite(row.quantity_sold));
}
