package handlers

const (
	headerContentType   = "Content-Type"
	mimeApplicationJSON = "application/json"
	mimeFormURLEncoded  = "application/x-www-form-urlencoded"
	mimeImageWebP       = "image/webp"
	uploadsPrefix          = "/uploads/"
	authBearerPrefix       = "Bearer "
	mimeSpreadsheetML        = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	mimeApplicationXMLUTF8   = "application/xml; charset=utf-8"
	siteBaseURL              = "https://mertervitrini.com.tr"
	errMsgInvalidCredentials = "E-posta veya şifre hatalı."
	errMsgLoginRequired      = "Giriş yapmanız gerekiyor."
	errJSONUnauthorized      = `{"error":"Yetkisiz erişim"}`
	errJSONInvalidPayload    = `{"error":"Geçersiz veri"}`
	errJSONTxBeginFailed     = `{"error":"İşlem başlatılamadı"}`
	errJSONMissingID         = `{"error":"ID zorunludur"}`
)
