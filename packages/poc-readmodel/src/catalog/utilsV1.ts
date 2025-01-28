// "EServiceAdded",
// "ClonedEServiceAdded"
// insert in all the tables (add delete at the beginning, for reprocessing)

// "EServiceUpdated"
// "EServiceRiskAnalysisAdded"
// "MovedAttributesFromEserviceToDescriptors"
// "EServiceRiskAnalysisUpdated"
// delete cascade from all the tables and replace

// "EServiceWithDescriptorsDeleted"
// delete cascade from descriptor

// "EServiceDocumentUpdated"
// update only in document table? (Delete and replace. Beware of interface and docs. If this events is only used for documents and never for interfaces, the insert could be simplified, otherwise we have to retrieve the kind somehow)
// IMPORTANT: interface also brings new serverUrls value in descriptor table

// "EServiceDeleted"
// delete cascade from eservice

// "EServiceDocumentAdded"
// same considerations of EServiceDocumentUpdated

// "EServiceDocumentDeleted"
// delete in document table, plus what about serverUrls? Maybe this is never used for interfaces

// "EServiceDescriptorAdded"
// create in all the tables from descriptor

// "EServiceDescriptorUpdated"
// replace cascade, from descriptor

// "EServiceRiskAnalysisDeleted"
// delete cascade from riskAnalysis
