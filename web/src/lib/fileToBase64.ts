const MAX_PROOF_BYTES = 4 * 1024 * 1024;

/** Read a file as raw base64 (no data: URL prefix). Rejects files over 4 MB. */
export function fileToBase64(file: File): Promise<string> {
  if (file.size > MAX_PROOF_BYTES) {
    return Promise.reject(new Error("Proof file must be 4 MB or smaller."));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Could not read proof file"));
        return;
      }
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("Could not read proof file"));
    reader.readAsDataURL(file);
  });
}

export { MAX_PROOF_BYTES };
