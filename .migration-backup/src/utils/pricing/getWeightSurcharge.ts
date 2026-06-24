export function getWeightSurcharge(weightKg: number | string) {
  const weight = Number(weightKg);

  return {
    min: 0,
    max: 0,
    needsCustomQuote: Number.isFinite(weight) && weight > 50,
    label: "Official flat local delivery price"
  };
}

export default getWeightSurcharge;
