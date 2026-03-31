const OLE_SIGNATURE = Buffer.from([
  0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
]);

export function isOleCompoundBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < OLE_SIGNATURE.length) {
    return false;
  }

  return buffer.subarray(0, OLE_SIGNATURE.length).equals(OLE_SIGNATURE);
}

export function removeDocProps(zip) {
  ["docProps/core.xml", "docProps/app.xml", "docProps/custom.xml"].forEach(
    (filePath) => {
      if (zip.file(filePath)) {
        zip.remove(filePath);
      }
    },
  );
}
