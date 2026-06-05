// Curated universe with approximate shares outstanding (used to compute market cap)
export const SMALL_CAP_UNIVERSE = [
  "BYRN",  "ENVX",  "RXRX",  "SEAT",  "TNDM",
  "IOVA",  "PRCT",  "GATO",  "EOLS",  "LUNG",
  "ACHR",  "CLSK",  "MARA",  "OPEN",  "FLNC",
  "ARQT",  "CRVL",  "HIMS",  "JOBY",  "ASTS",
  "RDDT",  "ACMR",  "FROG",  "ATAI",  "KRTX",
];

// Approximate shares outstanding in millions (updated periodically)
export const SHARES_OUTSTANDING: Record<string, number> = {
  BYRN:   44,    ENVX:  152,   RXRX:  331,   SEAT:  163,   TNDM:   65,
  IOVA:   198,   PRCT:   55,   GATO:  120,   EOLS:  196,   LUNG:    48,
  ACHR:   670,   CLSK:  280,   MARA:  400,   OPEN:  740,   FLNC:   205,
  ARQT:   93,    CRVL:   20,   HIMS:  223,   JOBY:  710,   ASTS:   380,
  RDDT:   200,   ACMR:   55,   FROG:  175,   ATAI:  145,   KRTX:    60,
};
