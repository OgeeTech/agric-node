/**
 * Parses the raw USSD text string into a usable state machine.
 * Africa's Talking sends inputs concatenated by asterisks (e.g., "1*2*50").
 */
const parseUssdText = (text) => {
  if (!text) return { step: 0, inputs: [] };
  const inputs = text.split("*");
  return { step: inputs.length, inputs };
};

module.exports = { parseUssdText };
