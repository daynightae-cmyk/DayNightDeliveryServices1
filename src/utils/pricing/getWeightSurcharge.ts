export function getWeightSurcharge(weightKg: number | string) {
  const weight = Number(weightKg);

  if (!weight || weight <= 1) {
    return {
      min: 0,
      max: 0,
      needsCustomQuote: false,
      label: "No additional weight surcharge"
    };
  }

  if (weight > 1 && weight <= 5) {
    return {
      min: 5,
      max: 10,
      needsCustomQuote: false,
      label: "Light weight surcharge"
    };
  }

  if (weight > 5 && weight <= 10) {
    return {
      min: 15,
      max: 25,
      needsCustomQuote: false,
      label: "Medium weight surcharge"
    };
  }

  if (weight > 10 && weight <= 20) {
    return {
      min: 30,
      max: 50,
      needsCustomQuote: false,
      label: "Heavy weight surcharge"
    };
  }

  return {
    min: 0,
    max: 0,
    needsCustomQuote: true,
    label: "Custom quote required"
  };
}

export default getWeightSurcharge;
