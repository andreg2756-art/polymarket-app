// 15 stocks per sector — all via Yahoo Finance, no API key needed
export const SECTOR_UNIVERSE: Record<string, string[]> = {
  Technology: [
    "ENVX","ACMR","FROG","CLSK","MARA","ASTS","RDDT","RXRX","ATAI","ACHR",
    "JOBY","OPEN","SMAR","DOMO","BIGC",
  ],
  Healthcare: [
    "HIMS","IOVA","PRCT","TNDM","EOLS","LUNG","ARQT","BYRN","CGEM","KRTX",
    "RXRX","INVA","SERA","AKRO","IMVT",
  ],
  Energy: [
    "FLNC","STEM","AMRC","NOVA","GEVO","PLUG","FCEL","BLNK","CHPT","EVGO",
    "PWR","BE","RUN","SPWR","ARRY",
  ],
  Financials: [
    "CRVL","SEAT","OPEN","LMND","HIPPO","MQ","DAVE","AFRM","UPST","LC",
    "SLM","HOOD","LPRO","SOFI","COOP",
  ],
  "Consumer Discretionary": [
    "HIMS","JOBY","BLMN","BJRI","BOOT","BOWL","CAKE","DENN","EAT","JACK",
    "SHAK","TXRH","WING","PBPB","PLAY",
  ],
  Industrials: [
    "ACHR","JOBY","BYRN","AVAV","KTOS","RCAT","ATRO","BETR","MFAC","CECO",
    "GFF","HAYN","HLIO","MTRX","POWL",
  ],
  Materials: [
    "GATO","MP","LTHM","SLI","UAMY","USAS","AUMN","EXK","GPL","MAG",
    "SILV","SSVR","VZLA","LAAC","PLL",
  ],
  "Communication Services": [
    "RDDT","BMBL","MTCH","CARG","TRUE","CARS","ANGI","IAC","QNST","BRZE",
    "SPRK","ZETA","DV","MGNI","PERI",
  ],
  "Real Estate": [
    "OPEN","RDFN","HOUS","DOUG","LGIH","SKY","UHG","DBRG","SAFE","GOOD",
    "STWD","BXMT","RC","GPMT","TPVG",
  ],
  Utilities: [
    "NOVA","RUN","SPWR","ARRY","SHLS","STEM","AMRC","GEVO","FCEL","PLUG",
    "BLNK","CHPT","EVGO","BE","HASI",
  ],
};

export const SMALL_CAP_UNIVERSE = [...new Set(Object.values(SECTOR_UNIVERSE).flat())];

// Approximate shares outstanding in millions (for market cap calculation)
export const SHARES_OUTSTANDING: Record<string, number> = {
  ENVX:152,  ACMR:55,   FROG:175,  CLSK:280,  MARA:400,  ASTS:380,  RDDT:200,
  RXRX:331,  ATAI:145,  ACHR:670,  JOBY:710,  OPEN:740,  SMAR:120,  DOMO:80,
  BIGC:70,   HIMS:223,  IOVA:198,  PRCT:55,   TNDM:65,   EOLS:196,  LUNG:48,
  ARQT:93,   BYRN:44,   CGEM:60,   KRTX:60,   INVA:80,   SERA:45,   AKRO:70,
  IMVT:90,   FLNC:205,  STEM:200,  AMRC:50,   NOVA:55,   GEVO:280,  PLUG:580,
  FCEL:300,  BLNK:55,   CHPT:350,  EVGO:300,  PWR:130,   BE:160,    RUN:210,
  SPWR:170,  ARRY:150,  CRVL:20,   SEAT:163,  LMND:60,   HIPPO:45,  MQ:550,
  DAVE:90,   AFRM:320,  UPST:130,  LC:110,    SLM:380,   HOOD:870,  LPRO:70,
  SOFI:980,  COOP:65,   BLMN:80,   BJRI:25,   BOOT:55,   BOWL:80,   CAKE:45,
  DENN:20,   EAT:45,    JACK:15,   SHAK:40,   TXRH:55,   WING:35,   PBPB:30,
  PLAY:50,   AVAV:45,   KTOS:155,  RCAT:30,   ATRO:35,   BETR:200,  MFAC:10,
  CECO:55,   GFF:40,    HAYN:12,   HLIO:40,   MTRX:20,   POWL:17,   GATO:120,
  MP:165,    LTHM:200,  SLI:80,    UAMY:180,  USAS:95,   AUMN:120,  EXK:175,
  GPL:250,   MAG:75,    SILV:65,   SSVR:80,   VZLA:400,  LAAC:250,  PLL:60,
  BMBL:90,   MTCH:265,  CARG:120,  TRUE:50,   CARS:55,   ANGI:500,  IAC:85,
  QNST:30,   BRZE:100,  SPRK:40,   ZETA:170,  DV:170,    MGNI:120,  PERI:60,
  RDFN:115,  HOUS:130,  DOUG:40,   LGIH:25,   SKY:55,    UHG:40,    DBRG:300,
  SAFE:70,   GOOD:30,   STWD:310,  BXMT:140,  RC:90,     GPMT:40,   TPVG:40,
  SHLS:150,  HASI:95,
};
