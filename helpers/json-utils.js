/**
 * Robustly parses a JSON string, even if it's surrounded by conversational text
 * or contains minor syntax errors like trailing commas or comments.
 * 
 * @param {string} str The string to parse
 * @returns {any|null} The parsed JSON object/array or null if failed
 */
export function robustJSONParse(str) {
  if (!str || typeof str !== 'string') return null;

  const cleanText = str.trim();

  // Helper function for bracket matching
  const extractBalanced = (input, startChar, endChar) => {
    const startIdx = input.indexOf(startChar);
    if (startIdx === -1) return null;
    
    let balance = 0;
    let inQuote = false;
    let escape = false;

    for (let i = startIdx; i < input.length; i++) {
      const char = input[i];
      if (char === '"' && !escape) inQuote = !inQuote;
      if (!inQuote) {
        if (char === startChar) balance++;
        else if (char === endChar) balance--;
        if (balance === 0) return input.substring(startIdx, i + 1);
      }
      escape = (char === '\\' && !escape);
    }
    return null;
  };

  try {
    // 1. Try to extract markdown code block first
    const codeBlockMatch = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const candidate = codeBlockMatch ? codeBlockMatch[1] : cleanText;
    
    // 2. Try direct parse on candidate
    try {
      return JSON.parse(candidate);
    } catch (e) {
      // 3. Fallback: Systematic extraction of first object or array
      const objMatch = extractBalanced(cleanText, '{', '}');
      const arrMatch = extractBalanced(cleanText, '[', ']');
      
      // Determine which one starts first
      const firstObj = cleanText.indexOf('{');
      const firstArr = cleanText.indexOf('[');
      
      let finalCandidate = null;
      if (firstObj !== -1 && (firstArr === -1 || firstObj < firstArr)) {
        finalCandidate = objMatch;
      } else if (firstArr !== -1) {
        finalCandidate = arrMatch;
      }

      if (!finalCandidate) return null;

      // 4. Final cleaning of the extracted candidate
      // Remove trailing commas
      finalCandidate = finalCandidate.replace(/,\s*([\]}])/g, '$1');
      // Remove comments
      finalCandidate = finalCandidate.replace(/(^|[^\:])\/\/.*$/gm, '$1');

      return JSON.parse(finalCandidate);
    }
  } catch (error) {
    return null;
  }
}
