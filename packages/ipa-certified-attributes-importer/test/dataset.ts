export const agencyDataset = {
  fields: [
    { id: "_id", type: "int" },
    {
      id: "Codice_IPA",
      type: "text",
      info: {
        type_override: "text",
        max_length: "100",
        notes: "Codice identificativo dell'ente",
      },
    },
    {
      id: "Denominazione_ente",
      type: "text",
      info: {
        type_override: "text",
        max_length: "1000",
        notes: "Denominazione dell'ente",
      },
    },
    {
      id: "Codice_fiscale_ente",
      type: "text",
      info: {
        type_override: "text",
        max_length: "16",
        notes: "Codice fiscale dell'ente",
      },
    },
    {
      id: "Tipologia",
      type: "text",
      info: {
        type_override: "text",
        max_length: "140",
        notes: "Descrizione della tipologia di appartenenza dell'ente",
      },
    },
    {
      id: "Codice_Categoria",
      type: "text",
      info: {
        type_override: "text",
        max_length: "5",
        notes: "Codice della categoria di appartenenza dell'ente",
      },
    },
    {
      id: "Codice_natura",
      type: "text",
      info: {
        type_override: "text",
        max_length: "4",
        notes: "Codice della natura giuridica dell'ente",
      },
    },
    {
      id: "Codice_ateco",
      type: "text",
      info: {
        type_override: "text",
        max_length: "8",
        notes: "Codice Ateco attribuito all'ente",
      },
    },
    {
      id: "Ente_in_liquidazione",
      type: "text",
      info: {
        type_override: "text",
        max_length: "1",
        notes: "Indicatore ente in liquidazione (valori S/N, null)",
      },
    },
    {
      id: "Codice_MIUR",
      type: "text",
      info: {
        type_override: "text",
        max_length: "10",
        notes: "Codice attribuito agli istituti scolastici dal MIUR",
      },
    },
    {
      id: "Codice_ISTAT",
      type: "text",
      info: {
        type_override: "text",
        max_length: "",
        notes: "Codice dell'ente negli elenchi ISTAT",
      },
    },
    {
      id: "Acronimo",
      type: "text",
      info: {
        type_override: "text",
        max_length: "100",
        notes: "Acronimo dell'ente",
      },
    },
    {
      id: "Nome_responsabile",
      type: "text",
      info: {
        type_override: "text",
        max_length: "50",
        notes: "Nome del responsabile dell'ente",
      },
    },
    {
      id: "Cognome_responsabile",
      type: "text",
      info: {
        type_override: "text",
        max_length: "50",
        notes: "Cognome del responsabile dell'ente",
      },
    },
    {
      id: "Titolo_responsabile",
      type: "text",
      info: {
        type_override: "text",
        max_length: "100",
        notes: "Qualifica del responsabile dell'ente",
      },
    },
    {
      id: "Codice_comune_ISTAT",
      type: "text",
      info: {
        type_override: "text",
        max_length: "6",
        notes: "Codice ISTAT del comune in cui ha sede l'ente",
      },
    },
    {
      id: "Codice_catastale_comune",
      type: "text",
      info: {
        type_override: "text",
        max_length: "4",
        notes: "Codice catastale del comune in cui ha sede l'ente",
      },
    },
    {
      id: "CAP",
      type: "text",
      info: {
        type_override: "text",
        max_length: "5",
        notes: "CAP della sede dell'ente",
      },
    },
    {
      id: "Indirizzo",
      type: "text",
      info: {
        type_override: "text",
        max_length: "246",
        notes: "Indirizzo della sede dell'ente",
      },
    },
    {
      id: "Mail1",
      type: "text",
      info: {
        type_override: "text",
        max_length: "256",
        notes: "Indirizzo mail dell'ente",
      },
    },
    {
      id: "Tipo_Mail1",
      type: "text",
      info: {
        type_override: "text",
        max_length: "5",
        notes: "Tipologia dell'indirizzo mail dell'ente (pec/altro)",
      },
    },
    {
      id: "Mail2",
      type: "text",
      info: {
        type_override: "text",
        max_length: "256",
        notes: "Indirizzo mail dell'ente",
      },
    },
    {
      id: "Tipo_Mail2",
      type: "text",
      info: {
        type_override: "text",
        max_length: "5",
        notes: "Tipologia dell'indirizzo mail dell'ente (pec/altro)",
      },
    },
    {
      id: "Mail3",
      type: "text",
      info: {
        type_override: "text",
        max_length: "256",
        notes: "Indirizzo mail dell'ente",
      },
    },
    {
      id: "Tipo_Mail3",
      type: "text",
      info: {
        type_override: "text",
        max_length: "5",
        notes: "Tipologia dell'indirizzo mail dell'ente (pec/altro)",
      },
    },
    {
      id: "Mail4",
      type: "text",
      info: {
        type_override: "text",
        max_length: "256",
        notes: "Indirizzo mail dell'ente",
      },
    },
    {
      id: "Tipo_Mail4",
      type: "text",
      info: {
        type_override: "text",
        max_length: "5",
        notes: "Tipologia dell'indirizzo mail dell'ente (pec/altro)",
      },
    },
    {
      id: "Mail5",
      type: "text",
      info: {
        type_override: "text",
        max_length: "256",
        notes: "Indirizzo mail dell'ente",
      },
    },
    {
      id: "Tipo_Mail5",
      type: "text",
      info: {
        type_override: "text",
        max_length: "5",
        notes: "Tipologia dell'indirizzo mail dell'ente (pec/altro)",
      },
    },
    {
      id: "Sito_istituzionale",
      type: "text",
      info: {
        type_override: "text",
        max_length: "256",
        notes: "Uri del sito web dell'ente",
      },
    },
    {
      id: "Url_facebook",
      type: "text",
      info: {
        type_override: "text",
        max_length: "1024",
        notes: "Uri della pagina facebook dell'ente",
      },
    },
    {
      id: "Url_linkedin",
      type: "text",
      info: {
        type_override: "text",
        max_length: "1024",
        notes: "Uri della pagina linkedin dell'ente",
      },
    },
    {
      id: "Url_twitter",
      type: "text",
      info: {
        type_override: "text",
        max_length: "1024",
        notes: "Uri della pagina twitter dell'ente",
      },
    },
    {
      id: "Url_youtube",
      type: "text",
      info: {
        type_override: "text",
        max_length: "1024",
        notes: "Uri della pagina youtube dell'ente",
      },
    },
    {
      id: "Data_aggiornamento",
      type: "text",
      info: {
        type_override: "text",
        max_length: "10",
        notes:
          "Maggiore tra la data di aggiornamento dati dell'Ente e data verifica (stringa nel formato yyyy-mm-dd)",
      },
    },
  ],
  records: [
    [
      23595,
      "Z1234ABC",
      "Municipality of Example City",
      "12345678901",
      "Stazioni Appaltanti",
      "SA",
      null,
      null,
      null,
      null,
      null,
      "ExampleCityGov",
      "John",
      "Doe",
      "Mayor",
      "010101",
      "X123",
      "12345",
      "Main Street 1",
      "example@pec.city.gov",
      "Pec",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      "www.examplecity.gov",
      null,
      null,
      null,
      null,
      "2024-02-01",
    ],
    [
      23596,
      "Z5678DEF",
      "Example Health Services",
      "98765432109",
      "Gestori di Pubblici Servizi",
      "L37",
      null,
      "86.90.1",
      null,
      null,
      null,
      "EHS",
      "Jane",
      "Smith",
      "CEO",
      "020202",
      "Y456",
      "67890",
      "Health Avenue 12",
      "health@pec.services.org",
      "Pec",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      "www.examplehealth.org",
      null,
      null,
      null,
      null,
      "2024-05-15",
    ],
    [
      23597,
      "Z9123GHI",
      "Example Educational Institute",
      "87654321098",
      "Pubbliche Amministrazioni",
      "L33",
      null,
      null,
      null,
      "EDU123456",
      null,
      null,
      "Mark",
      "Johnson",
      "Principal",
      "030303",
      "Z789",
      "54321",
      "Education Road 5",
      "education@pec.institute.edu",
      "Pec",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      "www.exampleinstitute.edu",
      null,
      null,
      null,
      null,
      "2023-11-10",
    ],
    [
      23598,
      "Z3456JKL",
      "Example Transportation Services",
      "76543210987",
      "Stazioni Appaltanti",
      "SA",
      null,
      "49.31",
      null,
      null,
      null,
      "ETS",
      "Emily",
      "Williams",
      "Director",
      "040404",
      "W321",
      "87654",
      "Transport Street 9",
      "transport@pec.services.org",
      "Pec",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      "www.exampletransport.com",
      null,
      null,
      null,
      null,
      "2024-06-25",
    ],
    [
      23599,
      "Z6789MNO",
      "Example Energy Company",
      "65432109876",
      "Gestori di Pubblici Servizi",
      "SAG",
      null,
      "35.14",
      null,
      null,
      null,
      "EXENERGY",
      "Michael",
      "Brown",
      "General Manager",
      "050505",
      "V654",
      "98765",
      "Energy Lane 3",
      "energy@pec.company.com",
      "Pec",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      "www.exampleenergy.com",
      null,
      null,
      null,
      null,
      "2024-03-17",
    ],
  ],
} as const;

export const aooDataset = {
  fields: [
    { id: "_id", type: "int" },
    {
      id: "Codice_IPA",
      type: "text",
      info: {
        type_override: "text",
        max_length: "100",
        notes: "Codice identificativo dell'ente",
      },
    },
    {
      id: "Denominazione_ente",
      type: "text",
      info: {
        type_override: "text",
        max_length: "1000",
        notes: "Denominazione dell'ente",
      },
    },
    {
      id: "Codice_fiscale_ente",
      type: "text",
      info: {
        type_override: "text",
        max_length: "16",
        notes: "Codice fiscale dell'ente",
      },
    },
    {
      id: "Codice_uni_aoo",
      type: "text",
      info: {
        type_override: "text",
        max_length: "7",
        notes:
          "Codice attribuito all'AOO dal sistema, composto da 7 caratteri di cui il primo è sempre il carattere A, identifica univocamente l'AOO nell'intero indice",
      },
    },
    {
      id: "Denominazione_aoo",
      type: "text",
      info: {
        type_override: "text",
        max_length: "1000",
        notes: "Denominazione dell'AOO",
      },
    },
    {
      id: "Data_istituzione",
      type: "text",
      info: {
        type_override: "text",
        max_length: "10",
        notes: "Data di istituzione dell'AOO (stringa nel formato yyyy-mm-dd)",
      },
    },
    {
      id: "Nome_responsabile",
      type: "text",
      info: {
        type_override: "text",
        max_length: "50",
        notes: "Nome del responsabile dell'AOO",
      },
    },
    {
      id: "Cognome_responsabile",
      type: "text",
      info: {
        type_override: "text",
        max_length: "50",
        notes: "Cognome del responsabile dell'AOO",
      },
    },
    {
      id: "Mail_responsabile",
      type: "text",
      info: {
        type_override: "text",
        max_length: "256",
        notes: "Mail del responsabile dell'AOO",
      },
    },
    {
      id: "Telefono_responsabile",
      type: "text",
      info: {
        type_override: "text",
        max_length: "50",
        notes: "Telefono del responsabile dell'AOO",
      },
    },
    {
      id: "Codice_comune_ISTAT",
      type: "text",
      info: {
        type_override: "text",
        max_length: "6",
        notes: "Codice ISTAT del comune in cui ha sede l'AOO",
      },
    },
    {
      id: "Codice_catastale_comune",
      type: "text",
      info: {
        type_override: "text",
        max_length: "4",
        notes: "Codice catastale del comune in cui ha sede l'AOO",
      },
    },
    {
      id: "CAP",
      type: "text",
      info: {
        type_override: "text",
        max_length: "5",
        notes: "CAP della sede dell'AOO",
      },
    },
    {
      id: "Indirizzo",
      type: "text",
      info: {
        type_override: "text",
        max_length: "246",
        notes: "Indirizzo della sede dell'AOO",
      },
    },
    {
      id: "Telefono",
      type: "text",
      info: {
        type_override: "text",
        max_length: "50",
        notes: "Telefono dell'AOO",
      },
    },
    {
      id: "Fax",
      type: "text",
      info: { type_override: "text", max_length: "50", notes: "Fax dell'AOO" },
    },
    {
      id: "Mail1",
      type: "text",
      info: {
        type_override: "text",
        max_length: "256",
        notes: "Indirizzo mail dell'AOO",
      },
    },
    {
      id: "Tipo_Mail1",
      type: "text",
      info: {
        type_override: "text",
        max_length: "5",
        notes: "Tipologia dell'indirizzo mail dell'AOO (pec/altro)",
      },
    },
    {
      id: "Mail2",
      type: "text",
      info: {
        type_override: "text",
        max_length: "256",
        notes: "Indirizzo mail dell'AOO",
      },
    },
    {
      id: "Tipo_Mail2",
      type: "text",
      info: {
        type_override: "text",
        max_length: "5",
        notes: "Tipologia dell'indirizzo mail dell'AOO (pec/altro)",
      },
    },
    {
      id: "Mail3",
      type: "text",
      info: {
        type_override: "text",
        max_length: "256",
        notes: "Indirizzo mail dell'AOO",
      },
    },
    {
      id: "Tipo_Mail3",
      type: "text",
      info: {
        type_override: "text",
        max_length: "5",
        notes: "Tipologia dell'indirizzo mail dell'AOO (pec/altro)",
      },
    },
    {
      id: "Protocollo_informatico",
      type: "text",
      info: {
        type_override: "text",
        max_length: "1",
        notes:
          "Flag che indica la presenza/assenza di un protocollo informatico (valori S/N/null)",
      },
    },
    {
      id: "URI_Protocollo_informatico",
      type: "text",
      info: {
        type_override: "text",
        max_length: "200",
        notes: "URI del protocollo informatico in caso di sua presenza",
      },
    },
    {
      id: "Data_aggiornamento",
      type: "text",
      info: {
        type_override: "text",
        max_length: "10",
        notes:
          "Maggiore tra la data di aggiornamento dati dell'AOO e data verifica (stringa nel formato yyyy-mm-dd)",
      },
    },
    {
      id: "cod_aoo",
      type: "text",
      info: {
        type_override: "text",
        max_length: "100",
        notes:
          "Codice attribuito all'AOO dal singolo ente, identifica univocamente l'AOO solo nell'ambito del singolo ente",
      },
    },
  ],
  records: [
    [
      38339,
      "ZZ9A7J5X",
      'Scuola Primaria "Giovanni Pascoli"',
      "90012345678",
      "B2A2H8J",
      "SCPGI",
      "2024-01-15",
      "Lucia",
      "Verdi",
      "l.verdi@istruzione.it",
      "0332345678",
      "045067",
      "H300",
      "37015",
      "Via Dante Alighieri, 12",
      null,
      null,
      "scpgi@pec.istruzione.it",
      "Pec",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      "SCPGI",
    ],
    [
      38340,
      "YY9A7J6Y",
      'Istituto Comprensivo "G. Marconi"',
      "90098765432",
      "C3B3I9K",
      "ICMAR",
      "2023-12-10",
      "Marco",
      "Rossi",
      "marco.rossi@istruzione.it",
      "0332233445",
      "056078",
      "A400",
      "58013",
      "Piazza Garibaldi, 1",
      null,
      null,
      "icmar@pec.istruzione.it",
      "Pec",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      "ICMAR",
    ],
    [
      38341,
      "XX9A7J7Z",
      'Scuola Secondaria di I Grado "Alighieri"',
      "90123456789",
      "D4C4J0L",
      "SSAL",
      "2024-02-20",
      "Anna",
      "Bianchi",
      "anna.bianchi@istruzione.it",
      "0331122334",
      "078045",
      "G500",
      "87030",
      "Corso Italia, 25",
      null,
      null,
      "ssal@pec.istruzione.it",
      "Pec",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      "SSAL",
    ],
    [
      38342,
      "WW9A7J8A",
      'Istituto Tecnico "Leonardo da Vinci"',
      "90234567890",
      "E5D5K1M",
      "ITLDV",
      "2024-03-15",
      "Giuseppe",
      "Neri",
      "giuseppe.neri@istruzione.it",
      "0345566778",
      "089123",
      "H600",
      "12045",
      "Viale Roma, 30",
      null,
      null,
      "itldv@pec.istruzione.it",
      "Pec",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      "ITLDV",
    ],
    [
      38343,
      "VV9A7J9B",
      'Liceo Classico "Virgilio"',
      "90345678901",
      "F6E6L2N",
      "LCVIR",
      "2024-04-22",
      "Clara",
      "Fabbri",
      "clara.fabbri@istruzione.it",
      "0356677889",
      "098765",
      "I700",
      "44022",
      "Via Milano, 42",
      null,
      null,
      "lcvir@pec.istruzione.it",
      "Pec",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      "LCVIR",
    ],
  ],
} as const;

export const uoDataset = {
  fields: [
    { id: "_id", type: "int" },
    {
      id: "Codice_IPA",
      type: "text",
      info: {
        type_override: "text",
        max_length: "100",
        notes: "Codice identificativo dell'ente",
      },
    },
    {
      id: "Denominazione_ente",
      type: "text",
      info: {
        type_override: "text",
        max_length: "1000",
        notes: "Denominazione dell'ente",
      },
    },
    {
      id: "Codice_fiscale_ente",
      type: "text",
      info: {
        type_override: "text",
        max_length: "16",
        notes: "Codice fiscale dell'ente",
      },
    },
    {
      id: "Codice_uni_uo",
      type: "text",
      info: {
        type_override: "text",
        max_length: "6",
        notes: "Codice univoco dell'UO in IPA",
      },
    },
    {
      id: "Codice_uni_aoo",
      type: "text",
      info: {
        type_override: "text",
        max_length: "7",
        notes: "Codice univoco dell'AOO a cui appartiene l'UO",
      },
    },
    {
      id: "Codice_uni_uo_padre",
      type: "text",
      info: {
        type_override: "text",
        max_length: "6",
        notes: "Codice univoco dell'Ufficio di livello superiore",
      },
    },
    {
      id: "Descrizione_uo",
      type: "text",
      info: {
        type_override: "text",
        max_length: "1000",
        notes: "Descrizione dell'UO",
      },
    },
    {
      id: "Data_istituzione",
      type: "text",
      info: {
        type_override: "text",
        max_length: "10",
        notes: "Data di istituzione dell'UO (stringa nel formato yyyy-mm-dd)",
      },
    },
    {
      id: "Nome_responsabile",
      type: "text",
      info: {
        type_override: "text",
        max_length: "50",
        notes: "Nome del responsabile dell'UO",
      },
    },
    {
      id: "Cognome_responsabile",
      type: "text",
      info: {
        type_override: "text",
        max_length: "50",
        notes: "Cognome del responsabile dell'UO",
      },
    },
    {
      id: "Mail_responsabile",
      type: "text",
      info: {
        type_override: "text",
        max_length: "256",
        notes: "Mail del responsabile dell'UO",
      },
    },
    {
      id: "Telefono_responsabile",
      type: "text",
      info: {
        type_override: "text",
        max_length: "50",
        notes: "Telefono del responsabile dell'UO",
      },
    },
    {
      id: "Codice_comune_ISTAT",
      type: "text",
      info: {
        type_override: "text",
        max_length: "6",
        notes: "Codice ISTAT del comune in cui ha sede l'UO",
      },
    },
    {
      id: "Codice_catastale_comune",
      type: "text",
      info: {
        type_override: "text",
        max_length: "4",
        notes: "Codice catastale del comune in cui ha sede l'UO",
      },
    },
    {
      id: "CAP",
      type: "text",
      info: {
        type_override: "text",
        max_length: "5",
        notes: "CAP della sede dell'UO",
      },
    },
    {
      id: "Indirizzo",
      type: "text",
      info: {
        type_override: "text",
        max_length: "246",
        notes: "Indirizzo della sede dell'UO",
      },
    },
    {
      id: "Telefono",
      type: "text",
      info: {
        type_override: "text",
        max_length: "50",
        notes: "Telefono dell'UO",
      },
    },
    {
      id: "Fax",
      type: "text",
      info: { type_override: "text", max_length: "50", notes: "Fax dell'UO" },
    },
    {
      id: "Mail1",
      type: "text",
      info: {
        type_override: "text",
        max_length: "256",
        notes: "Indirizzo mail dell'UO",
      },
    },
    {
      id: "Tipo_Mail1",
      type: "text",
      info: {
        type_override: "text",
        max_length: "5",
        notes: "Tipologia dell'indirizzo mail dell'UO (pec/altro)",
      },
    },
    {
      id: "Mail2",
      type: "text",
      info: {
        type_override: "text",
        max_length: "256",
        notes: "Indirizzo mail dell'UO",
      },
    },
    {
      id: "Tipo_Mail2",
      type: "text",
      info: {
        type_override: "text",
        max_length: "5",
        notes: "Tipologia dell'indirizzo mail dell'UO (pec/altro)",
      },
    },
    {
      id: "Mail3",
      type: "text",
      info: {
        type_override: "text",
        max_length: "256",
        notes: "Indirizzo mail dell'UO",
      },
    },
    {
      id: "Tipo_Mail3",
      type: "text",
      info: {
        type_override: "text",
        max_length: "5",
        notes: "Tipologia dell'indirizzo mail dell'UO (pec/altro)",
      },
    },
    {
      id: "Data_aggiornamento",
      type: "text",
      info: {
        type_override: "text",
        max_length: "10",
        notes:
          "Maggiore tra la data di aggiornamento dati dell'UO e data verifica (stringa nel formato yyyy-mm-dd)",
      },
    },
    {
      id: "Url",
      type: "text",
      info: { type_override: "text", max_length: "256", notes: "URL dell'UO" },
    },
  ],
  records: [
    [
      117193,
      "ZX9M2HJ7",
      "AZIENDA SANITARIA LOCALE ROMA 1",
      "80576370584",
      "CXY56D",
      "NRKL78D",
      null,
      "Ufficio per la transizione al Digitale",
      "2023-03-15",
      "Lucia",
      "Morelli",
      "lucia.morelli@aslroma1.it",
      null,
      "055012",
      "H412",
      "00152",
      "Via Roma, 100",
      null,
      null,
      "segreteria.asl@pec.it",
      "Altro",
      null,
      null,
      null,
      null,
      null,
      null,
    ],
    [
      117194,
      "ZW0P9J2D",
      "LICEO SCIENTIFICO STATALE GALILEO GALILEI",
      "91045670482",
      "KJ4W9T",
      "UYFT4AH",
      null,
      "Ufficio per la transizione al Digitale",
      "2022-10-01",
      "Giovanni",
      "Bianchi",
      "rtd@liceogalilei.it",
      null,
      "055012",
      "H412",
      "00153",
      "Via Galilei, 45",
      null,
      null,
      "rtd@liceogalilei.it",
      "Altro",
      null,
      null,
      null,
      null,
      null,
      null,
    ],
    [
      117195,
      "ZX7E8QSG",
      "ISTITUTO TECNICO INDUSTRIALE STATALE LEONARDO DA VINCI",
      "92067380495",
      "JQXA93",
      "BGJPH34",
      null,
      "Ufficio per la transizione al Digitale",
      "2022-11-05",
      "Marta",
      "Verdi",
      "marta.verdi@itdavinci.it",
      null,
      "120056",
      "E340",
      "40127",
      "Via Leonardo, 27",
      null,
      null,
      "itdavinci@pec.it",
      "Pec",
      null,
      null,
      null,
      null,
      null,
      null,
    ],
    [
      117196,
      "ZZ8F4MT2",
      "AZIENDA OSPEDALIERA POLICLINICO",
      "80234560327",
      "LX82QR",
      "KH7JLN3",
      null,
      "Ufficio Amministrativo",
      "2023-04-22",
      "Paolo",
      "Rossi",
      "paolo.rossi@policlinico.it",
      null,
      "045002",
      "E350",
      "20121",
      "Piazza Duomo, 12",
      null,
      null,
      "amministrazione@pec.policlinico.it",
      "Altro",
      null,
      null,
      null,
      null,
      null,
      null,
    ],
    [
      117197,
      "ZZ7W1AB3",
      "COMUNE DI NAPOLI",
      "12345678901",
      "MN43JW",
      "XJPL29R",
      null,
      "Ufficio Tecnico",
      "2023-05-10",
      "Giulia",
      "Esposito",
      "giulia.esposito@comune.napoli.it",
      null,
      "062010",
      "E322",
      "80100",
      "Piazza Municipio, 1",
      null,
      null,
      "comune.napoli@pec.it",
      "Altro",
      null,
      null,
      null,
      null,
      null,
      null,
    ],
  ],
} as const;
