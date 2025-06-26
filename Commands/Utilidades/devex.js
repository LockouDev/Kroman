const { InteractionContextType, EmbedBuilder, SlashCommandBuilder, ApplicationIntegrationType, MessageFlags } = require('discord.js');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const ConversionRate = 0.0035

const translations = {
    id: {
        exchangeSelected: 'Pertukaran yang Dipilih:',
        enteredValue: 'Nilai yang Dimasukkan:',
        result: 'Hasil:',
        errorTitle: 'Kesalahan Konversi ❌',
        errorDescription: 'Tidak dapat mengambil nilai tukar. Silakan coba lagi nanti.',
    },
    da: {
        exchangeSelected: 'Valuta valgt:',
        enteredValue: 'Indtastet værdi:',
        result: 'Resultat:',
        errorTitle: 'Konverteringsfejl ❌',
        errorDescription: 'Kunne ikke hente valutakurs. Prøv igen senere.',
    },
    de: {
        exchangeSelected: 'Ausgewählter Wechselkurs:',
        enteredValue: 'Eingegebener Wert:',
        result: 'Ergebnis:',
        errorTitle: 'Umrechnungsfehler ❌',
        errorDescription: 'Wechselkurs konnte nicht abgerufen werden. Bitte versuchen Sie es später erneut.',
    },
    'en-GB': {
        exchangeSelected: 'Exchange Selected:',
        enteredValue: 'Entered Value:',
        result: 'Result:',
        errorTitle: 'Conversion Error ❌',
        errorDescription: 'Unable to fetch exchange rate. Please try again later.',
    },
    'en-US': {
        exchangeSelected: 'Exchange Selected:',
        enteredValue: 'Entered Value:',
        result: 'Result:',
        errorTitle: 'Conversion Error ❌',
        errorDescription: 'Unable to fetch exchange rate. Please try again later.',
    },
    'es-ES': {
        exchangeSelected: 'Cambio Seleccionado:',
        enteredValue: 'Valor Ingresado:',
        result: 'Resultado:',
        errorTitle: 'Error de Conversión ❌',
        errorDescription: 'No se pudo obtener la tasa de cambio. Por favor, inténtelo de nuevo más tarde.',
    },
    'es-419': {
        exchangeSelected: 'Cambio Seleccionado:',
        enteredValue: 'Valor Ingresado:',
        result: 'Resultado:',
        errorTitle: 'Error de Conversión ❌',
        errorDescription: 'No se pudo obtener la tasa de cambio. Por favor, inténtelo de nuevo más tarde.',
    },
    fr: {
        exchangeSelected: 'Échange Sélectionné:',
        enteredValue: 'Valeur Entrée:',
        result: 'Résultat:',
        errorTitle: 'Erreur de Conversion ❌',
        errorDescription: 'Impossible de récupérer le taux de change. Veuillez réessayer plus tard.',
    },
    hr: {
        exchangeSelected: 'Odabrana Razmjena:',
        enteredValue: 'Unesena Vrijednost:',
        result: 'Rezultat:',
        errorTitle: 'Greška u Konverziji ❌',
        errorDescription: 'Nije moguće dohvatiti tečaj. Pokušajte ponovo kasnije.',
    },
    it: {
        exchangeSelected: 'Cambio Selezionato:',
        enteredValue: 'Valore Inserito:',
        result: 'Risultato:',
        errorTitle: 'Errore di Conversione ❌',
        errorDescription: 'Impossibile recuperare il tasso di cambio. Per favore riprova più tardi.',
    },
    lt: {
        exchangeSelected: 'Pasirinktas Valiutų Kursas:',
        enteredValue: 'Įvesta Vertė:',
        result: 'Rezultatas:',
        errorTitle: 'Konvertavimo Klaida ❌',
        errorDescription: 'Nepavyko gauti valiutų kurso. Bandykite dar kartą vėliau.',
    },
    hu: {
        exchangeSelected: 'Kiválasztott Átváltási Arány:',
        enteredValue: 'Beírt Érték:',
        result: 'Eredmény:',
        errorTitle: 'Átváltási Hiba ❌',
        errorDescription: 'Nem sikerült lekérni az árfolyamot. Kérjük, próbálja újra később.',
    },
    nl: {
        exchangeSelected: 'Geselecteerde Wisselkoers:',
        enteredValue: 'Ingevoerde Waarde:',
        result: 'Resultaat:',
        errorTitle: 'Conversiefout ❌',
        errorDescription: 'Kon de wisselkoers niet ophalen. Probeer het later opnieuw.',
    },
    no: {
        exchangeSelected: 'Valutaveksling Valgt:',
        enteredValue: 'Inntastet Verdi:',
        result: 'Resultat:',
        errorTitle: 'Konverteringsfeil ❌',
        errorDescription: 'Kunne ikke hente valutakurs. Vennligst prøv igjen senere.',
    },
    pl: {
        exchangeSelected: 'Wybrany Kurs Wymiany:',
        enteredValue: 'Wprowadzona Wartość:',
        result: 'Wynik:',
        errorTitle: 'Błąd Konwersji ❌',
        errorDescription: 'Nie udało się pobrać kursu wymiany. Spróbuj ponownie później.',
    },
    'pt-BR': {
        exchangeSelected: 'Câmbio Selecionado:',
        enteredValue: 'Valor Informado:',
        result: 'Resultado:',
        errorTitle: 'Erro na Conversão ❌',
        errorDescription: 'Não foi possível obter a taxa de câmbio. Por favor, tente novamente mais tarde.',
    },
    ro: {
        exchangeSelected: 'Schimb Valutar Selectat:',
        enteredValue: 'Valoare Introduc:',
        result: 'Rezultat:',
        errorTitle: 'Eroare de Conversie ❌',
        errorDescription: 'Nu s-a putut prelua cursul valutar. Încercați din nou mai târziu.',
    },
    fi: {
        exchangeSelected: 'Valittu Vaihtokurssi:',
        enteredValue: 'Syötetty Arvo:',
        result: 'Tulos:',
        errorTitle: 'Muuntovirhe ❌',
        errorDescription: 'Vaihtokurssin haku epäonnistui. Yritä myöhemmin uudelleen.',
    },
    'sv-SE': {
        exchangeSelected: 'Valt Växlingskurs:',
        enteredValue: 'Angivet Värde:',
        result: 'Resultat:',
        errorTitle: 'Konverteringsfel ❌',
        errorDescription: 'Kunde inte hämta växelkurs. Försök igen senare.',
    },
    vi: {
        exchangeSelected: 'Tỷ Giá Đã Chọn:',
        enteredValue: 'Giá Trị Nhập Vào:',
        result: 'Kết Quả:',
        errorTitle: 'Lỗi Chuyển Đổi ❌',
        errorDescription: 'Không thể truy xuất tỷ giá. Vui lòng thử lại sau.',
    },
    tr: {
        exchangeSelected: 'Seçilen Döviz Kuru:',
        enteredValue: 'Girilen Değer:',
        result: 'Sonuç:',
        errorTitle: 'Dönüşüm Hatası ❌',
        errorDescription: 'Döviz kuru alınamadı. Lütfen daha sonra tekrar deneyin.',
    },
    cs: {
        exchangeSelected: 'Vybraný Směnný Kurz:',
        enteredValue: 'Zadaná Hodnota:',
        result: 'Výsledek:',
        errorTitle: 'Chyba Převodu ❌',
        errorDescription: 'Nepodařilo se načíst směnný kurz. Zkuste to prosím později.',
    },
    el: {
        exchangeSelected: 'Επιλεγμένη Ισοτιμία:',
        enteredValue: 'Καταχωρημένη Τιμή:',
        result: 'Αποτέλεσμα:',
        errorTitle: 'Σφάλμα Μετατροπής ❌',
        errorDescription: 'Δεν ήταν δυνατή η ανάκτηση της ισοτιμίας. Παρακαλώ δοκιμάστε αργότερα.',
    },
    bg: {
        exchangeSelected: 'Избран Валутен Курс:',
        enteredValue: 'Въведена Стойност:',
        result: 'Резултат:',
        errorTitle: 'Грешка при Конвертиране ❌',
        errorDescription: 'Неуспешно извличане на валутния курс. Моля, опитайте по-късно.',
    },
    ru: {
        exchangeSelected: 'Выбранный Курс Обмена:',
        enteredValue: 'Введённое Значение:',
        result: 'Результат:',
        errorTitle: 'Ошибка Конвертации ❌',
        errorDescription: 'Не удалось получить обменный курс. Пожалуйста, попробуйте позже.',
    },
    uk: {
        exchangeSelected: 'Обраний Курс Обміну:',
        enteredValue: 'Введене Значення:',
        result: 'Результат:',
        errorTitle: 'Помилка Конвертації ❌',
        errorDescription: 'Не вдалося отримати курс обміну. Будь ласка, спробуйте пізніше.',
    },
    hi: {
        exchangeSelected: 'चयनित विनिमय दर:',
        enteredValue: 'दर्ज किया गया मान:',
        result: 'परिणाम:',
        errorTitle: 'रूपांतरण त्रुटि ❌',
        errorDescription: 'विनिमय दर प्राप्त नहीं हो सकी। कृपया बाद में पुनः प्रयास करें।',
    },
    th: {
        exchangeSelected: 'อัตราแลกเปลี่ยนที่เลือก:',
        enteredValue: 'ค่าที่ป้อน:',
        result: 'ผลลัพธ์:',
        errorTitle: 'ข้อผิดพลาดในการแปลง ❌',
        errorDescription: 'ไม่สามารถดึงอัตราแลกเปลี่ยนได้ กรุณาลองใหม่ในภายหลัง',
    },
    'zh-CN': {
        exchangeSelected: '选择的汇率:',
        enteredValue: '输入的值:',
        result: '结果:',
        errorTitle: '转换错误 ❌',
        errorDescription: '无法获取汇率。请稍后再试。',
    },
    ja: {
        exchangeSelected: '選択した為替レート:',
        enteredValue: '入力された値:',
        result: '結果:',
        errorTitle: '変換エラー ❌',
        errorDescription: '為替レートを取得できませんでした。後でもう一度お試しください。',
    },
    'zh-TW': {
        exchangeSelected: '選擇的匯率:',
        enteredValue: '輸入的值:',
        result: '結果:',
        errorTitle: '轉換錯誤 ❌',
        errorDescription: '無法獲取匯率。請稍後再試。',
    },
    ko: {
        exchangeSelected: '선택한 환율:',
        enteredValue: '입력된 값:',
        result: '결과:',
        errorTitle: '변환 오류 ❌',
        errorDescription: '환율을 가져올 수 없습니다. 나중에 다시 시도하십시오.',
    },
};

const getTranslation = (locale, key) => {

    const language = locale.split('-')[0];

    return translations[locale]?.[key] || translations[language]?.[key] || translations['en'][key] || key;

};

module.exports = {

    data: new SlashCommandBuilder()
        .setName('devex')
        .setDescription('Calculadora 🧮')
        .setDescription('Calcula o valor em DevEx do Roblox')
        .setDescriptionLocalizations({
            id: 'Menghitung nilai DevEx di Roblox',
            da: 'Beregner DevEx-værdien i Roblox',
            de: 'Berechnet den DevEx-Wert von Roblox',
            'en-GB': 'Calculates the DevEx value in Roblox',
            'en-US': 'Calculates the DevEx value in Roblox',
            'es-ES': 'Calcula el valor en DevEx en Roblox',
            'es-419': 'Calcula el valor en DevEx en Roblox',
            fr: 'Calcule la valeur DevEx dans Roblox',
            hr: 'Izračunava DevEx vrijednost u Robloxu',
            it: 'Calcola il valore DevEx su Roblox',
            lt: 'Apskaičiuoja DevEx vertę Roblox',
            hu: 'Kiszámítja a DevEx értéket a Robloxban',
            nl: 'Bereken de DevEx-waarde in Roblox',
            no: 'Beregner DevEx-verdien i Roblox',
            pl: 'Oblicza wartość DevEx w Roblox',
            'pt-BR': 'Calcula o valor em DevEx do Roblox',
            ro: 'Calculează valoarea DevEx în Roblox',
            fi: 'Laskee DevEx-arvon Robloxissa',
            'sv-SE': 'Beräknar DevEx-värdet i Roblox',
            vi: 'Tính giá trị DevEx trong Roblox',
            tr: 'Roblox’ta DevEx değerini hesaplar',
            cs: 'Vypočítá hodnotu DevEx v Robloxu',
            el: 'Υπολογίζει την τιμή DevEx στο Roblox',
            bg: 'Изчислява стойността на DevEx в Roblox',
            ru: 'Вычисляет значение DevEx в Roblox',
            uk: 'Розраховує значення DevEx у Roblox',
            hi: 'Roblox में DevEx मान की गणना करता है',
            th: 'คำนวณค่า DevEx ใน Roblox',
            'zh-CN': '计算 Roblox 中的 DevEx 值',
            ja: 'Roblox の DevEx 値を計算します',
            'zh-TW': '計算 Roblox 中的 DevEx 值',
            ko: 'Roblox에서 DevEx 값을 계산합니다',
        })
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
        .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
        .addStringOption(option =>
            option.setName('cambio')
                .setNameLocalizations({
                    id: 'mata_uang',
                    da: 'valuta',
                    de: 'wechselkurs',
                    'en-GB': 'currency',
                    'en-US': 'currency',
                    'es-ES': 'divisa',
                    'es-419': 'divisa',
                    fr: 'devise',
                    hr: 'valuta',
                    it: 'valuta',
                    lt: 'valiuta',
                    hu: 'valuta',
                    nl: 'valuta',
                    no: 'valuta',
                    pl: 'waluta',
                    'pt-BR': 'moeda',
                    ro: 'valută',
                    fi: 'valuutta',
                    'sv-SE': 'valuta',
                    vi: 'tiente',
                    tr: 'doviz',
                    cs: 'mena',
                    el: 'νόμισμα',
                    bg: 'валута',
                    ru: 'валюта',
                    uk: 'валюта',
                    hi: 'मुद्रा',
                    th: 'สกุลเงิน',
                    'zh-CN': '货币',
                    ja: '通貨',
                    'zh-TW': '貨幣',
                    ko: '화폐',
                })
                .setDescription('Escolha o câmbio de dinheiro que deseja converter')
                .setDescriptionLocalizations({
                    id: 'Pilih mata uang untuk dikonversi',
                    da: 'Vælg valuta at konvertere til',
                    de: 'Wählen Sie die Währung, die Sie umrechnen möchten',
                    'en-GB': 'Choose the currency to convert to',
                    'en-US': 'Choose the currency to convert to',
                    'es-ES': 'Elija la moneda que desea convertir',
                    'es-419': 'Elija la moneda que desea convertir',
                    fr: 'Choisissez la devise à convertir',
                    hr: 'Odaberite valutu za pretvorbu',
                    it: 'Scegli la valuta da convertire',
                    lt: 'Pasirinkite valiutą konvertavimui',
                    hu: 'Válassza ki az átváltandó pénznemet',
                    nl: 'Kies de valuta om naar om te rekenen',
                    no: 'Velg valuta for konvertering',
                    pl: 'Wybierz walutę do przeliczenia',
                    'pt-BR': 'Escolha o câmbio de dinheiro que deseja converter',
                    ro: 'Alegeți moneda de convertit',
                    fi: 'Valitse valuutta, johon haluat muuntaa',
                    'sv-SE': 'Välj valuta att konvertera till',
                    vi: 'Chọn loại tiền để chuyển đổi',
                    tr: 'Dönüştürülecek para birimini seçin',
                    cs: 'Vyberte měnu k převodu',
                    el: 'Επιλέξτε το νόμισμα προς μετατροπή',
                    bg: 'Изберете валута за конвертиране',
                    ru: 'Выберите валюту для конвертации',
                    uk: 'Оберіть валюту для конвертації',
                    hi: 'कृपया मुद्रा चुनें',
                    th: 'เลือกสกุลเงินที่จะคำนวณ',
                    'zh-CN': '选择要转换的货币',
                    ja: '変換する通貨を選択してください',
                    'zh-TW': '選擇要轉換的貨幣',
                    ko: '변환할 통화를 선택하세요',
                })
                .setRequired(true)
                .addChoices(

                    { name: 'BRL 🇧🇷', value: 'brl' },
                    { name: 'USD 🇺🇸', value: 'usd' },
                    { name: 'EUR 🇪🇺', value: 'eur' },
                    { name: 'GBP 🇬🇧', value: 'gbp' },
                    { name: 'JPY 🇯🇵', value: 'jpy' },
                    { name: 'AUD 🇦🇺', value: 'aud' },
                    { name: 'CAD 🇨🇦', value: 'cad' },
                    { name: 'CHF 🇨🇭', value: 'chf' },
                    { name: 'CNY 🇨🇳', value: 'cny' },
                    { name: 'SEK 🇸🇪', value: 'sek' },
                    { name: 'NZD 🇳🇿', value: 'nzd' },
                    { name: 'MXN 🇲🇽', value: 'mxn' },
                    { name: 'SGD 🇸🇬', value: 'sgd' },
                    { name: 'HKD 🇭🇰', value: 'hkd' },
                    { name: 'NOK 🇳🇴', value: 'nok' },
                    { name: 'KRW 🇰🇷', value: 'krw' },
                    { name: 'TRY 🇹🇷', value: 'try' },
                    { name: 'INR 🇮🇳', value: 'inr' },
                    { name: 'ZAR 🇿🇦', value: 'zar' },
                    { name: 'PLN 🇵🇱', value: 'pln' },
                    { name: 'DKK 🇩🇰', value: 'dkk' },
                    { name: 'VND 🇻🇳', value: 'vnd' },
                    { name: 'AED 🇦🇪', value: 'aed' }

                ))

        .addIntegerOption(option =>
            option.setName('valor')
                .setDescription('Valor total para ser convertido')
                .setRequired(true)),

    async run(client, interaction) {

        const locale = interaction.locale || 'en-US';
        const cambio = interaction.options.getString('cambio');
        const valor = interaction.options.getInteger('valor');
        const translate = (key) => getTranslation(locale, key);

        try {

            let exchangeRate = 1;

            if (cambio !== 'usd') {

                const response = await fetch(`https://economia.awesomeapi.com.br/json/last/USD-${cambio.toUpperCase()}`);
                const data = await response.json();

                exchangeRate = parseFloat(data[Object.keys(data)[0]].ask);

            }

            const convertedValue = valor * exchangeRate * ConversionRate;

            const embed = new EmbedBuilder()

                .setColor('#98F768')
                .addFields(

                    { name: translate('exchangeSelected'), value: cambio.toUpperCase(), inline: false },
                    { name: translate('enteredValue'), value: `<:Robux:1311957287178469447> ${valor.toLocaleString()}`, inline: false },
                    { name: translate('result'), value: `${convertedValue.toFixed(2)} ${cambio.toUpperCase()}`, inline: false }
                );

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Erro ao obter o valor de cambio:', error);

            const embed = new EmbedBuilder()

                .setColor('#FF0000')
                .setTitle(translate('errorTitle'))
                .setDescription(translate('errorDescription'));

            await interaction.reply({ embeds: [embed], ephemeral: true });

        }

    },

};