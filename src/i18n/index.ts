import { useMemo } from 'react';
import { SUPPORTED_LANGUAGES, type SupportedLanguageCode, resolveLanguageLocale } from '@/constants/languages';
import { useTransactionStore } from '@/store/transaction-store';

type TranslationParams = Record<string, string | number>;
type TranslationMap = Record<string, string>;

const en: TranslationMap = {
  'tabs.home': 'Home',
  'tabs.transactions': 'Transactions',
  'tabs.analytics': 'Analytics',
  'tabs.profile': 'Profile',
  'tabs.calendar': 'Calendar',
  'tabs.accounts': 'Accounts',
  'tabs.notes': 'Notes',
  'tabs.planning': 'Planning',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.open': 'Open',
  'common.done': 'Done',
  'common.save': 'Save',
  'common.error': 'Error',
  'common.reset': 'Reset',
  'common.account': 'Account',
  'common.accounts': 'Accounts',
  'common.currency': 'Currency',
  'common.date': 'Date',
  'common.amount': 'Amount',
  'common.category': 'Category',
  'common.description': 'Description',
  'common.from': 'From',
  'common.to': 'To',
  'common.unknown': 'Unknown',
  'common.remove': 'Remove',
  'settings.title': 'App Settings',
  'settings.section.notifications': 'Notifications',
  'settings.section.preferences': 'Preferences',
  'settings.section.profile': 'Profile',
  'settings.section.support': 'Support',
  'settings.section.privacyBackup': 'Privacy & Backup',
  'settings.section.backup': 'Backup',
  'settings.budgetAlerts.title': 'Budget Alerts',
  'settings.budgetAlerts.subtitle': 'Receive budget and spending notifications',
  'settings.quickAdd.title': 'Quick Add Shortcut',
  'settings.quickAdd.subtitle': 'Open quick add from the notification shade',
  'settings.dailyReminder.title': 'Daily Reminder',
  'settings.dailyReminder.subtitle': 'Get reminded to log your spending each day',
  'settings.reminderTime.title': 'Reminder Time',
  'settings.reminderTime.subtitle': 'Choose when the daily reminder should appear',
  'settings.darkMode.title': 'Dark Mode',
  'settings.darkMode.subtitle': 'Switch between light and dark appearance',
  'settings.currency.title': 'Currency',
  'settings.currency.subtitle': 'Choose your primary currency',
  'settings.language.title': 'Language',
  'settings.autoLock.title': 'Auto Lock',
  'settings.autoLock.subtitle': 'Lock the app automatically after inactivity',
  'settings.editProfile.title': 'Edit Profile',
  'settings.editProfile.subtitle': 'Update details for {accountName}',
  'settings.addAccount.title': 'Add Account',
  'settings.addAccount.subtitle': 'Open the Accounts tab and start a new account',
  'settings.helpSupport.title': 'Help & Support',
  'settings.helpSupport.subtitle': 'Contact support, FAQs, and app help',
  'settings.backupCenter.title': 'Backup Center',
  'settings.backupCenter.subtitle': 'JSON, CSV, and Google Drive backups',
  'settings.privacy.title': 'Privacy',
  'settings.privacy.subtitle': 'Manage security and privacy controls',
  'settings.clearData.title': 'Clear Data',
  'settings.clearData.subtitle': 'Delete all transactions, accounts, and notes',
  'settings.autoBackup.title': 'Auto Backup',
  'settings.autoBackup.subtitle': 'Keep Google Drive backups up to date automatically',
  'settings.lastBackup': 'Last backup: {date}',
  'settings.currencyUpdated': 'Currency set to {code}',
  'settings.languageUpdated': 'Language set to {name}',
  'autoLock.never': 'Never',
  'autoLock.immediately': 'Immediately',
  'autoLock.after1Minute': 'After 1 minute',
  'autoLock.afterMinutes': 'After {minutes} minutes',
  'home.metricTooltip.budget': 'Open the Budget screen to review active budgets.',
  'home.metricTooltip.health': 'Open Financial Health to see your full score breakdown.',
  'home.metricTooltip.goals': 'Open Planning to manage goals and milestones.',
  'home.metricTooltip.savings': 'Open Accounts to review your savings balances.',
  'home.addType.title': 'Add transaction',
  'home.addType.message': 'Choose a type',
  'addTransaction.expense': 'Expense',
  'addTransaction.income': 'Income',
  'addTransaction.transfer': 'Transfer',
  'addTransaction.debt': 'Debt',
  'addTransaction.selectCategory': 'Select category',
  'addTransaction.selectAccount': 'Select account',
  'addTransaction.enterDescription': 'Enter description',
  'addTransaction.transferPreview': 'Transfer Preview',
  'addTransaction.receiptScanning': 'Receipt Scanning',
  'addTransaction.scanReceipt': 'Scan Receipt',
  'addTransaction.receiptHint': 'Use the camera button beside Add Transaction to upload a receipt photo and fill transaction details automatically',
  'addTransaction.receiptExtractedHint': 'Details extracted from receipt.',
  'addTransaction.debtDetails': 'Debt Details',
  'addTransaction.borrowed': 'Borrowed',
  'addTransaction.lent': 'Lent',
  'addTransaction.counterparty': 'Counterparty',
  'addTransaction.dueDatePlaceholder': 'Due date (DD/MM/YYYY)',
  'addTransaction.interestRatePlaceholder': 'Interest rate (%)',
  'addTransaction.addButton': 'Add Transaction',
  'addTransaction.useCamera': 'Use Camera',
  'addTransaction.chooseFromGallery': 'Choose from Gallery',
  'addTransaction.debtPayment': 'Debt Payment',
  'addTransaction.recurringTransaction': 'Recurring Transaction',
  'addTransaction.daily': 'Daily',
  'addTransaction.weekly': 'Weekly',
  'addTransaction.monthly': 'Monthly',
  'addTransaction.yearly': 'Yearly',
  'addTransaction.endDatePlaceholder': 'End date (DD/MM/YYYY)',
  'categorySheet.searchPlaceholder': 'Search categories',
  'categorySheet.add': 'Add "{name}"',
  'categorySheet.addHint': 'Save it as a new category',
  'categorySheet.createThisCategory': 'Create this category to use it.',
  'categorySheet.noneFound': 'No categories found',
  'categorySheet.noneAvailable': 'No categories available',
  'accountSheet.noneAvailable': 'No accounts available',
  'accountSheet.createAccount': 'Create account',
  'accountSheet.accessibility.createAccount': 'Create account',
  'accountSheet.accessibility.openAccounts': 'Open accounts',
  'amountCalculator.title': 'Amount',
  'amountCalculator.accessibility.currency': 'Currency',
  'amountCalculator.accessibility.delete': 'Delete',
  'quickAccount.newAccount': 'New Account',
  'quickAccount.saveAccount': 'Save Account',
  'quickAccount.intro': 'Create an account without leaving this transaction.',
  'quickAccount.accountName': 'Account Name',
  'quickAccount.accountNamePlaceholder': 'Account name',
  'quickAccount.openingBalance': 'Opening Balance',
  'quickAccount.openingBalanceDate': 'Opening Balance Date',
  'quickAccount.openingBalanceHint': 'The opening balance is recorded once when this account is created.',
  'quickAccount.accountType': 'Account Type',
  'quickAccount.validationName': 'Account name is required.',
  'quickAccount.validationBalance': 'Please enter a valid opening balance.',
  'quickAccount.type.checking.label': 'Checking',
  'quickAccount.type.checking.description': 'Daily income and spending',
  'quickAccount.type.savings.label': 'Savings',
  'quickAccount.type.savings.description': 'Emergency funds and goals',
  'quickAccount.type.credit.label': 'Credit',
  'quickAccount.type.credit.description': 'Cards and short-term debt',
  'quickAccount.type.investment.label': 'Investment',
  'quickAccount.type.investment.description': 'Long-term growth accounts',
  'quickAccount.type.cash.label': 'Cash',
  'quickAccount.type.cash.description': 'Wallet and petty cash',
};

const es: TranslationMap = {
  'tabs.home': 'Inicio', 'tabs.transactions': 'Transacciones', 'tabs.analytics': 'Anal�ticas', 'tabs.profile': 'Perfil', 'tabs.calendar': 'Calendario', 'tabs.accounts': 'Cuentas', 'tabs.notes': 'Notas', 'tabs.planning': 'Planificaci�n',
  'common.cancel': 'Cancelar', 'common.delete': 'Eliminar', 'common.open': 'Abrir', 'common.done': 'Listo', 'common.save': 'Guardar', 'common.error': 'Error', 'common.reset': 'Restablecer', 'common.account': 'Cuenta', 'common.accounts': 'Cuentas', 'common.currency': 'Moneda', 'common.date': 'Fecha', 'common.amount': 'Monto', 'common.category': 'Categor�a', 'common.description': 'Descripci�n', 'common.from': 'Desde', 'common.to': 'Hasta', 'common.unknown': 'Desconocido', 'common.remove': 'Quitar',
  'settings.title': 'Configuraci�n', 'settings.section.notifications': 'Notificaciones', 'settings.section.preferences': 'Preferencias', 'settings.section.profile': 'Perfil', 'settings.section.support': 'Soporte', 'settings.section.privacyBackup': 'Privacidad y respaldo', 'settings.section.backup': 'Respaldo',
  'settings.budgetAlerts.title': 'Alertas de presupuesto', 'settings.budgetAlerts.subtitle': 'Recibe notificaciones de presupuesto y gasto', 'settings.quickAdd.title': 'Acceso r�pido', 'settings.quickAdd.subtitle': 'Abrir acceso r�pido desde la barra de notificaciones', 'settings.dailyReminder.title': 'Recordatorio diario', 'settings.dailyReminder.subtitle': 'Recibe un recordatorio diario para registrar tus gastos', 'settings.reminderTime.title': 'Hora del recordatorio', 'settings.reminderTime.subtitle': 'Elige cu�ndo debe aparecer el recordatorio diario', 'settings.darkMode.title': 'Modo oscuro', 'settings.darkMode.subtitle': 'Cambia entre apariencia clara y oscura', 'settings.currency.title': 'Moneda', 'settings.currency.subtitle': 'Elige tu moneda principal', 'settings.language.title': 'Idioma', 'settings.autoLock.title': 'Bloqueo autom�tico', 'settings.autoLock.subtitle': 'Bloquea la app autom�ticamente tras inactividad', 'settings.editProfile.title': 'Editar perfil', 'settings.editProfile.subtitle': 'Actualiza los datos de {accountName}', 'settings.addAccount.title': 'Agregar cuenta', 'settings.addAccount.subtitle': 'Abre la pesta�a Cuentas y crea una nueva cuenta', 'settings.helpSupport.title': 'Ayuda y soporte', 'settings.helpSupport.subtitle': 'Contacto, preguntas frecuentes y ayuda de la app', 'settings.backupCenter.title': 'Centro de respaldo', 'settings.backupCenter.subtitle': 'Respaldos JSON, CSV y Google Drive', 'settings.privacy.title': 'Privacidad', 'settings.privacy.subtitle': 'Administra la seguridad y la privacidad', 'settings.clearData.title': 'Borrar datos', 'settings.clearData.subtitle': 'Elimina todas las transacciones, cuentas y notas', 'settings.autoBackup.title': 'Respaldo autom�tico', 'settings.autoBackup.subtitle': 'Mant�n los respaldos de Google Drive actualizados autom�ticamente', 'settings.lastBackup': '�ltimo respaldo: {date}', 'settings.currencyUpdated': 'Moneda establecida en {code}', 'settings.languageUpdated': 'Idioma establecido en {name}',
  'autoLock.never': 'Nunca', 'autoLock.immediately': 'Inmediatamente', 'autoLock.after1Minute': 'Despu�s de 1 minuto', 'autoLock.afterMinutes': 'Despu�s de {minutes} minutos',
  'home.metricTooltip.budget': 'Abre Presupuesto para revisar los presupuestos activos.', 'home.metricTooltip.health': 'Abre Salud financiera para ver el desglose completo.', 'home.metricTooltip.goals': 'Abre Planificaci�n para gestionar metas e hitos.', 'home.metricTooltip.savings': 'Abre Cuentas para revisar tus ahorros.', 'home.addType.title': 'Agregar transacci�n', 'home.addType.message': 'Elige un tipo',
  'addTransaction.expense': 'Gasto', 'addTransaction.income': 'Ingreso', 'addTransaction.transfer': 'Transferencia', 'addTransaction.debt': 'Deuda', 'addTransaction.selectCategory': 'Seleccionar categor�a', 'addTransaction.selectAccount': 'Seleccionar cuenta', 'addTransaction.enterDescription': 'Ingresa una descripci�n', 'addTransaction.transferPreview': 'Vista previa de transferencia', 'addTransaction.receiptScanning': 'Escaneo de recibo', 'addTransaction.scanReceipt': 'Escanear recibo', 'addTransaction.receiptHint': 'Usa el bot�n de c�mara junto a Agregar transacci�n para subir un recibo y completar los detalles autom�ticamente', 'addTransaction.debtDetails': 'Detalles de la deuda', 'addTransaction.borrowed': 'Prestado', 'addTransaction.lent': 'Prestado a otro', 'addTransaction.counterparty': 'Contraparte', 'addTransaction.dueDatePlaceholder': 'Fecha de vencimiento (DD/MM/YYYY)', 'addTransaction.interestRatePlaceholder': 'Tasa de inter�s (%)', 'addTransaction.addButton': 'Agregar transacci�n', 'addTransaction.useCamera': 'Usar c�mara', 'addTransaction.chooseFromGallery': 'Elegir de galer�a', 'addTransaction.debtPayment': 'Pago de deuda', 'addTransaction.recurringTransaction': 'Transacci�n recurrente', 'addTransaction.daily': 'Diario', 'addTransaction.weekly': 'Semanal', 'addTransaction.monthly': 'Mensual', 'addTransaction.yearly': 'Anual', 'addTransaction.endDatePlaceholder': 'Fecha final (DD/MM/YYYY)',
  'categorySheet.searchPlaceholder': 'Buscar categor�as', 'categorySheet.add': 'Agregar "{name}"', 'categorySheet.addHint': 'Gu�rdalo como una nueva categor�a', 'categorySheet.createThisCategory': 'Crea esta categor�a para usarla.', 'categorySheet.noneFound': 'No se encontraron categor�as', 'categorySheet.noneAvailable': 'No hay categor�as disponibles',
  'accountSheet.noneAvailable': 'No hay cuentas disponibles', 'accountSheet.createAccount': 'Crear cuenta', 'accountSheet.accessibility.createAccount': 'Crear cuenta', 'accountSheet.accessibility.openAccounts': 'Abrir cuentas', 'amountCalculator.title': 'Monto', 'amountCalculator.accessibility.currency': 'Moneda', 'amountCalculator.accessibility.delete': 'Eliminar',
  'quickAccount.newAccount': 'Nueva cuenta', 'quickAccount.saveAccount': 'Guardar cuenta', 'quickAccount.intro': 'Crea una cuenta sin salir de esta transacci�n.', 'quickAccount.accountName': 'Nombre de la cuenta', 'quickAccount.accountNamePlaceholder': 'Nombre de la cuenta', 'quickAccount.openingBalance': 'Saldo inicial', 'quickAccount.openingBalanceDate': 'Fecha del saldo inicial', 'quickAccount.openingBalanceHint': 'El saldo inicial se registra una sola vez al crear la cuenta.', 'quickAccount.accountType': 'Tipo de cuenta', 'quickAccount.validationName': 'El nombre de la cuenta es obligatorio.', 'quickAccount.validationBalance': 'Ingresa un saldo inicial v�lido.', 'quickAccount.type.checking.label': 'Corriente', 'quickAccount.type.checking.description': 'Ingresos y gastos diarios', 'quickAccount.type.savings.label': 'Ahorros', 'quickAccount.type.savings.description': 'Fondos de emergencia y metas', 'quickAccount.type.credit.label': 'Cr�dito', 'quickAccount.type.credit.description': 'Tarjetas y deuda a corto plazo', 'quickAccount.type.investment.label': 'Inversi�n', 'quickAccount.type.investment.description': 'Cuentas de crecimiento a largo plazo', 'quickAccount.type.cash.label': 'Efectivo', 'quickAccount.type.cash.description': 'Billetera y caja chica',
};

const fr: TranslationMap = {
  'tabs.home': 'Accueil', 'tabs.transactions': 'Transactions', 'tabs.analytics': 'Analyses', 'tabs.profile': 'Profil', 'tabs.calendar': 'Calendrier', 'tabs.accounts': 'Comptes', 'tabs.notes': 'Notes', 'tabs.planning': 'Planification',
  'common.cancel': 'Annuler', 'common.delete': 'Supprimer', 'common.open': 'Ouvrir', 'common.done': 'Termin�', 'common.save': 'Enregistrer', 'common.error': 'Erreur', 'common.reset': 'R�initialiser', 'common.account': 'Compte', 'common.accounts': 'Comptes', 'common.currency': 'Devise', 'common.date': 'Date', 'common.amount': 'Montant', 'common.category': 'Cat�gorie', 'common.description': 'Description', 'common.from': 'De', 'common.to': '�', 'common.unknown': 'Inconnu', 'common.remove': 'Retirer',
  'settings.title': 'Param�tres', 'settings.section.notifications': 'Notifications', 'settings.section.preferences': 'Pr�f�rences', 'settings.section.profile': 'Profil', 'settings.section.support': 'Assistance', 'settings.section.privacyBackup': 'Confidentialit� et sauvegarde', 'settings.section.backup': 'Sauvegarde',
  'settings.budgetAlerts.title': 'Alertes de budget', 'settings.budgetAlerts.subtitle': 'Recevez des notifications de budget et de d�penses', 'settings.quickAdd.title': 'Raccourci rapide', 'settings.quickAdd.subtitle': 'Ouvrir l�ajout rapide depuis la zone de notifications', 'settings.dailyReminder.title': 'Rappel quotidien', 'settings.dailyReminder.subtitle': 'Recevez un rappel quotidien pour enregistrer vos d�penses', 'settings.reminderTime.title': 'Heure du rappel', 'settings.reminderTime.subtitle': 'Choisissez quand le rappel quotidien doit appara�tre', 'settings.darkMode.title': 'Mode sombre', 'settings.darkMode.subtitle': 'Basculer entre apparence claire et sombre', 'settings.currency.title': 'Devise', 'settings.currency.subtitle': 'Choisissez votre devise principale', 'settings.language.title': 'Langue', 'settings.autoLock.title': 'Verrouillage automatique', 'settings.autoLock.subtitle': 'Verrouille l�application automatiquement apr�s inactivit�', 'settings.editProfile.title': 'Modifier le profil', 'settings.editProfile.subtitle': 'Mettre � jour les informations de {accountName}', 'settings.addAccount.title': 'Ajouter un compte', 'settings.addAccount.subtitle': 'Ouvrir l�onglet Comptes et cr�er un nouveau compte', 'settings.helpSupport.title': 'Aide et assistance', 'settings.helpSupport.subtitle': 'Contact, FAQ et aide de l�application', 'settings.backupCenter.title': 'Centre de sauvegarde', 'settings.backupCenter.subtitle': 'Sauvegardes JSON, CSV et Google Drive', 'settings.privacy.title': 'Confidentialit�', 'settings.privacy.subtitle': 'G�rer les param�tres de s�curit� et de confidentialit�', 'settings.clearData.title': 'Effacer les donn�es', 'settings.clearData.subtitle': 'Supprime toutes les transactions, comptes et notes', 'settings.autoBackup.title': 'Sauvegarde automatique', 'settings.autoBackup.subtitle': 'Maintenez vos sauvegardes Google Drive � jour automatiquement', 'settings.lastBackup': 'Derni�re sauvegarde : {date}', 'settings.currencyUpdated': 'Devise d�finie sur {code}', 'settings.languageUpdated': 'Langue d�finie sur {name}',
  'autoLock.never': 'Jamais', 'autoLock.immediately': 'Imm�diatement', 'autoLock.after1Minute': 'Apr�s 1 minute', 'autoLock.afterMinutes': 'Apr�s {minutes} minutes',
  'home.metricTooltip.budget': 'Ouvrez Budget pour consulter les budgets actifs.', 'home.metricTooltip.health': 'Ouvrez Sant� financi�re pour voir le d�tail complet.', 'home.metricTooltip.goals': 'Ouvrez Planification pour g�rer objectifs et jalons.', 'home.metricTooltip.savings': 'Ouvrez Comptes pour consulter vos soldes d��pargne.', 'home.addType.title': 'Ajouter une transaction', 'home.addType.message': 'Choisissez un type',
  'addTransaction.expense': 'D�pense', 'addTransaction.income': 'Revenu', 'addTransaction.transfer': 'Transfert', 'addTransaction.debt': 'Dette', 'addTransaction.selectCategory': 'S�lectionner une cat�gorie', 'addTransaction.selectAccount': 'S�lectionner un compte', 'addTransaction.enterDescription': 'Saisir une description', 'addTransaction.transferPreview': 'Aper�u du transfert', 'addTransaction.receiptScanning': 'Lecture du re�u', 'addTransaction.scanReceipt': 'Analyser le re�u', 'addTransaction.receiptHint': 'Utilisez le bouton cam�ra � c�t� de Ajouter une transaction pour importer un re�u et remplir automatiquement les d�tails', 'addTransaction.debtDetails': 'D�tails de la dette', 'addTransaction.borrowed': 'Emprunt�', 'addTransaction.lent': 'Pr�t�', 'addTransaction.counterparty': 'Contrepartie', 'addTransaction.dueDatePlaceholder': 'Date d��ch�ance (DD/MM/YYYY)', 'addTransaction.interestRatePlaceholder': 'Taux d�int�r�t (%)', 'addTransaction.addButton': 'Ajouter une transaction', 'addTransaction.useCamera': 'Utiliser l�appareil photo', 'addTransaction.chooseFromGallery': 'Choisir depuis la galerie', 'addTransaction.debtPayment': 'Remboursement de dette', 'addTransaction.recurringTransaction': 'Transaction r�currente', 'addTransaction.daily': 'Quotidien', 'addTransaction.weekly': 'Hebdomadaire', 'addTransaction.monthly': 'Mensuel', 'addTransaction.yearly': 'Annuel', 'addTransaction.endDatePlaceholder': 'Date de fin (DD/MM/YYYY)',
  'categorySheet.searchPlaceholder': 'Rechercher des cat�gories', 'categorySheet.add': 'Ajouter "{name}"', 'categorySheet.addHint': 'L�enregistrer comme nouvelle cat�gorie', 'categorySheet.createThisCategory': 'Cr�ez cette cat�gorie pour l�utiliser.', 'categorySheet.noneFound': 'Aucune cat�gorie trouv�e', 'categorySheet.noneAvailable': 'Aucune cat�gorie disponible',
  'accountSheet.noneAvailable': 'Aucun compte disponible', 'accountSheet.createAccount': 'Cr�er un compte', 'accountSheet.accessibility.createAccount': 'Cr�er un compte', 'accountSheet.accessibility.openAccounts': 'Ouvrir les comptes', 'amountCalculator.title': 'Montant', 'amountCalculator.accessibility.currency': 'Devise', 'amountCalculator.accessibility.delete': 'Supprimer',
  'quickAccount.newAccount': 'Nouveau compte', 'quickAccount.saveAccount': 'Enregistrer le compte', 'quickAccount.intro': 'Cr�ez un compte sans quitter cette transaction.', 'quickAccount.accountName': 'Nom du compte', 'quickAccount.accountNamePlaceholder': 'Nom du compte', 'quickAccount.openingBalance': 'Solde initial', 'quickAccount.openingBalanceDate': 'Date du solde initial', 'quickAccount.openingBalanceHint': 'Le solde initial est enregistr� une seule fois lors de la cr�ation du compte.', 'quickAccount.accountType': 'Type de compte', 'quickAccount.validationName': 'Le nom du compte est requis.', 'quickAccount.validationBalance': 'Veuillez saisir un solde initial valide.', 'quickAccount.type.checking.label': 'Courant', 'quickAccount.type.checking.description': 'Revenus et d�penses quotidiens', 'quickAccount.type.savings.label': '�pargne', 'quickAccount.type.savings.description': 'Fonds d�urgence et objectifs', 'quickAccount.type.credit.label': 'Cr�dit', 'quickAccount.type.credit.description': 'Cartes et dette � court terme', 'quickAccount.type.investment.label': 'Investissement', 'quickAccount.type.investment.description': 'Comptes de croissance � long terme', 'quickAccount.type.cash.label': 'Esp�ces', 'quickAccount.type.cash.description': 'Portefeuille et petite caisse',
};

const de: TranslationMap = {
  'tabs.home': 'Start', 'tabs.transactions': 'Transaktionen', 'tabs.analytics': 'Analysen', 'tabs.profile': 'Profil', 'tabs.calendar': 'Kalender', 'tabs.accounts': 'Konten', 'tabs.notes': 'Notizen', 'tabs.planning': 'Planung',
  'common.cancel': 'Abbrechen', 'common.delete': 'L�schen', 'common.open': '�ffnen', 'common.done': 'Fertig', 'common.save': 'Speichern', 'common.error': 'Fehler', 'common.reset': 'Zur�cksetzen', 'common.account': 'Konto', 'common.accounts': 'Konten', 'common.currency': 'W�hrung', 'common.date': 'Datum', 'common.amount': 'Betrag', 'common.category': 'Kategorie', 'common.description': 'Beschreibung', 'common.from': 'Von', 'common.to': 'Nach', 'common.unknown': 'Unbekannt', 'common.remove': 'Entfernen',
  'settings.title': 'Einstellungen', 'settings.section.notifications': 'Benachrichtigungen', 'settings.section.preferences': 'Einstellungen', 'settings.section.profile': 'Profil', 'settings.section.support': 'Support', 'settings.section.privacyBackup': 'Datenschutz und Backup', 'settings.section.backup': 'Backup',
  'settings.budgetAlerts.title': 'Budgetwarnungen', 'settings.budgetAlerts.subtitle': 'Erhalte Benachrichtigungen zu Budget und Ausgaben', 'settings.quickAdd.title': 'Schnellzugriff', 'settings.quickAdd.subtitle': 'Schnell hinzuf�gen aus der Benachrichtigungsleiste �ffnen', 'settings.dailyReminder.title': 'T�gliche Erinnerung', 'settings.dailyReminder.subtitle': 'T�gliche Erinnerung zum Erfassen deiner Ausgaben', 'settings.reminderTime.title': 'Erinnerungszeit', 'settings.reminderTime.subtitle': 'W�hle, wann die t�gliche Erinnerung erscheinen soll', 'settings.darkMode.title': 'Dunkelmodus', 'settings.darkMode.subtitle': 'Zwischen heller und dunkler Darstellung wechseln', 'settings.currency.title': 'W�hrung', 'settings.currency.subtitle': 'W�hle deine Hauptw�hrung', 'settings.language.title': 'Sprache', 'settings.autoLock.title': 'Automatische Sperre', 'settings.autoLock.subtitle': 'App nach Inaktivit�t automatisch sperren', 'settings.editProfile.title': 'Profil bearbeiten', 'settings.editProfile.subtitle': 'Details f�r {accountName} aktualisieren', 'settings.addAccount.title': 'Konto hinzuf�gen', 'settings.addAccount.subtitle': 'Zur Konten-Ansicht wechseln und ein neues Konto erstellen', 'settings.helpSupport.title': 'Hilfe und Support', 'settings.helpSupport.subtitle': 'Kontakt, FAQ und App-Hilfe', 'settings.backupCenter.title': 'Backup-Center', 'settings.backupCenter.subtitle': 'JSON-, CSV- und Google-Drive-Backups', 'settings.privacy.title': 'Datenschutz', 'settings.privacy.subtitle': 'Sicherheits- und Datenschutzeinstellungen verwalten', 'settings.clearData.title': 'Daten l�schen', 'settings.clearData.subtitle': 'Alle Transaktionen, Konten und Notizen l�schen', 'settings.autoBackup.title': 'Automatisches Backup', 'settings.autoBackup.subtitle': 'Google-Drive-Backups automatisch aktuell halten', 'settings.lastBackup': 'Letztes Backup: {date}', 'settings.currencyUpdated': 'W�hrung auf {code} gesetzt', 'settings.languageUpdated': 'Sprache auf {name} gesetzt',
  'autoLock.never': 'Nie', 'autoLock.immediately': 'Sofort', 'autoLock.after1Minute': 'Nach 1 Minute', 'autoLock.afterMinutes': 'Nach {minutes} Minuten',
  'home.metricTooltip.budget': '�ffne Budget, um aktive Budgets zu pr�fen.', 'home.metricTooltip.health': '�ffne Finanzgesundheit f�r die vollst�ndige Auswertung.', 'home.metricTooltip.goals': '�ffne Planung, um Ziele und Meilensteine zu verwalten.', 'home.metricTooltip.savings': '�ffne Konten, um deine Sparguthaben zu pr�fen.', 'home.addType.title': 'Transaktion hinzuf�gen', 'home.addType.message': 'Typ ausw�hlen',
  'addTransaction.expense': 'Ausgabe', 'addTransaction.income': 'Einnahme', 'addTransaction.transfer': '�berweisung', 'addTransaction.debt': 'Schuld', 'addTransaction.selectCategory': 'Kategorie ausw�hlen', 'addTransaction.selectAccount': 'Konto ausw�hlen', 'addTransaction.enterDescription': 'Beschreibung eingeben', 'addTransaction.transferPreview': '�berweisungsvorschau', 'addTransaction.receiptScanning': 'Belegerkennung', 'addTransaction.scanReceipt': 'Beleg scannen', 'addTransaction.receiptHint': 'Nutze die Kamerataste neben Transaktion hinzuf�gen, um einen Beleg hochzuladen und Details automatisch zu f�llen', 'addTransaction.debtDetails': 'Schulddetails', 'addTransaction.borrowed': 'Geliehen', 'addTransaction.lent': 'Verliehen', 'addTransaction.counterparty': 'Gegenpartei', 'addTransaction.dueDatePlaceholder': 'F�lligkeitsdatum (DD/MM/YYYY)', 'addTransaction.interestRatePlaceholder': 'Zinssatz (%)', 'addTransaction.addButton': 'Transaktion hinzuf�gen', 'addTransaction.useCamera': 'Kamera verwenden', 'addTransaction.chooseFromGallery': 'Aus Galerie w�hlen', 'addTransaction.debtPayment': 'Schuldr�ckzahlung', 'addTransaction.recurringTransaction': 'Wiederkehrende Transaktion', 'addTransaction.daily': 'T�glich', 'addTransaction.weekly': 'W�chentlich', 'addTransaction.monthly': 'Monatlich', 'addTransaction.yearly': 'J�hrlich', 'addTransaction.endDatePlaceholder': 'Enddatum (DD/MM/YYYY)',
  'categorySheet.searchPlaceholder': 'Kategorien suchen', 'categorySheet.add': '"{name}" hinzuf�gen', 'categorySheet.addHint': 'Als neue Kategorie speichern', 'categorySheet.createThisCategory': 'Erstelle diese Kategorie, um sie zu verwenden.', 'categorySheet.noneFound': 'Keine Kategorien gefunden', 'categorySheet.noneAvailable': 'Keine Kategorien verf�gbar',
  'accountSheet.noneAvailable': 'Keine Konten verf�gbar', 'accountSheet.createAccount': 'Konto erstellen', 'accountSheet.accessibility.createAccount': 'Konto erstellen', 'accountSheet.accessibility.openAccounts': 'Konten �ffnen', 'amountCalculator.title': 'Betrag', 'amountCalculator.accessibility.currency': 'W�hrung', 'amountCalculator.accessibility.delete': 'L�schen',
  'quickAccount.newAccount': 'Neues Konto', 'quickAccount.saveAccount': 'Konto speichern', 'quickAccount.intro': 'Erstelle ein Konto, ohne diese Transaktion zu verlassen.', 'quickAccount.accountName': 'Kontoname', 'quickAccount.accountNamePlaceholder': 'Kontoname', 'quickAccount.openingBalance': 'Anfangssaldo', 'quickAccount.openingBalanceDate': 'Datum des Anfangssaldos', 'quickAccount.openingBalanceHint': 'Der Anfangssaldo wird einmalig bei der Kontoerstellung erfasst.', 'quickAccount.accountType': 'Kontotyp', 'quickAccount.validationName': 'Kontoname ist erforderlich.', 'quickAccount.validationBalance': 'Bitte einen g�ltigen Anfangssaldo eingeben.', 'quickAccount.type.checking.label': 'Girokonto', 'quickAccount.type.checking.description': 'T�gliche Einnahmen und Ausgaben', 'quickAccount.type.savings.label': 'Sparen', 'quickAccount.type.savings.description': 'Notfallfonds und Ziele', 'quickAccount.type.credit.label': 'Kredit', 'quickAccount.type.credit.description': 'Karten und kurzfristige Schulden', 'quickAccount.type.investment.label': 'Investition', 'quickAccount.type.investment.description': 'Langfristige Wachstumskonten', 'quickAccount.type.cash.label': 'Bargeld', 'quickAccount.type.cash.description': 'Portemonnaie und Kasse',
};

const it: TranslationMap = {
  'tabs.home': 'Home', 'tabs.transactions': 'Transazioni', 'tabs.analytics': 'Analisi', 'tabs.profile': 'Profilo', 'tabs.calendar': 'Calendario', 'tabs.accounts': 'Conti', 'tabs.notes': 'Note', 'tabs.planning': 'Pianificazione',
  'common.cancel': 'Annulla', 'common.delete': 'Elimina', 'common.open': 'Apri', 'common.done': 'Fine', 'common.save': 'Salva', 'common.error': 'Errore', 'common.reset': 'Reimposta', 'common.account': 'Conto', 'common.accounts': 'Conti', 'common.currency': 'Valuta', 'common.date': 'Data', 'common.amount': 'Importo', 'common.category': 'Categoria', 'common.description': 'Descrizione', 'common.from': 'Da', 'common.to': 'A', 'common.unknown': 'Sconosciuto', 'common.remove': 'Rimuovi',
  'settings.title': 'Impostazioni', 'settings.section.notifications': 'Notifiche', 'settings.section.preferences': 'Preferenze', 'settings.section.profile': 'Profilo', 'settings.section.support': 'Supporto', 'settings.section.privacyBackup': 'Privacy e backup', 'settings.section.backup': 'Backup', 'settings.budgetAlerts.title': 'Avvisi budget', 'settings.budgetAlerts.subtitle': 'Ricevi notifiche su budget e spese', 'settings.quickAdd.title': 'Scorciatoia rapida', 'settings.quickAdd.subtitle': 'Apri l�aggiunta rapida dalla tendina notifiche', 'settings.dailyReminder.title': 'Promemoria giornaliero', 'settings.dailyReminder.subtitle': 'Ricevi un promemoria giornaliero per registrare le spese', 'settings.reminderTime.title': 'Ora del promemoria', 'settings.reminderTime.subtitle': 'Scegli quando mostrare il promemoria giornaliero', 'settings.darkMode.title': 'Tema scuro', 'settings.darkMode.subtitle': 'Passa tra aspetto chiaro e scuro', 'settings.currency.title': 'Valuta', 'settings.currency.subtitle': 'Scegli la valuta principale', 'settings.language.title': 'Lingua', 'settings.autoLock.title': 'Blocco automatico', 'settings.autoLock.subtitle': 'Blocca automaticamente l�app dopo inattivit�', 'settings.editProfile.title': 'Modifica profilo', 'settings.editProfile.subtitle': 'Aggiorna i dettagli di {accountName}', 'settings.addAccount.title': 'Aggiungi conto', 'settings.addAccount.subtitle': 'Apri la scheda Conti e crea un nuovo conto', 'settings.helpSupport.title': 'Aiuto e supporto', 'settings.helpSupport.subtitle': 'Contatti, FAQ e aiuto dell�app', 'settings.backupCenter.title': 'Centro backup', 'settings.backupCenter.subtitle': 'Backup JSON, CSV e Google Drive', 'settings.privacy.title': 'Privacy', 'settings.privacy.subtitle': 'Gestisci sicurezza e controlli privacy', 'settings.clearData.title': 'Cancella dati', 'settings.clearData.subtitle': 'Elimina tutte le transazioni, i conti e le note', 'settings.autoBackup.title': 'Backup automatico', 'settings.autoBackup.subtitle': 'Mantieni aggiornati automaticamente i backup su Google Drive', 'settings.lastBackup': 'Ultimo backup: {date}', 'settings.currencyUpdated': 'Valuta impostata su {code}', 'settings.languageUpdated': 'Lingua impostata su {name}', 'autoLock.never': 'Mai', 'autoLock.immediately': 'Subito', 'autoLock.after1Minute': 'Dopo 1 minuto', 'autoLock.afterMinutes': 'Dopo {minutes} minuti',
  'home.metricTooltip.budget': 'Apri Budget per controllare i budget attivi.', 'home.metricTooltip.health': 'Apri Salute finanziaria per vedere il dettaglio completo.', 'home.metricTooltip.goals': 'Apri Pianificazione per gestire obiettivi e traguardi.', 'home.metricTooltip.savings': 'Apri Conti per controllare i saldi dei risparmi.', 'home.addType.title': 'Aggiungi transazione', 'home.addType.message': 'Scegli un tipo',
  'addTransaction.expense': 'Spesa', 'addTransaction.income': 'Entrata', 'addTransaction.transfer': 'Trasferimento', 'addTransaction.debt': 'Debito', 'addTransaction.selectCategory': 'Seleziona categoria', 'addTransaction.selectAccount': 'Seleziona conto', 'addTransaction.enterDescription': 'Inserisci descrizione', 'addTransaction.transferPreview': 'Anteprima trasferimento', 'addTransaction.receiptScanning': 'Scansione ricevuta', 'addTransaction.scanReceipt': 'Scansiona ricevuta', 'addTransaction.receiptHint': 'Usa il pulsante fotocamera accanto ad Aggiungi transazione per caricare una ricevuta e compilare automaticamente i dettagli', 'addTransaction.receiptExtractedHint': 'Dettagli estratti dalla ricevuta.', 'addTransaction.debtDetails': 'Dettagli debito', 'addTransaction.borrowed': 'Preso in prestito', 'addTransaction.lent': 'Prestato', 'addTransaction.counterparty': 'Controparte', 'addTransaction.dueDatePlaceholder': 'Scadenza (DD/MM/YYYY)', 'addTransaction.interestRatePlaceholder': 'Tasso di interesse (%)', 'addTransaction.addButton': 'Aggiungi transazione', 'addTransaction.useCamera': 'Usa fotocamera', 'addTransaction.chooseFromGallery': 'Scegli dalla galleria', 'addTransaction.debtPayment': 'Pagamento debito', 'addTransaction.recurringTransaction': 'Transazione ricorrente', 'addTransaction.daily': 'Giornaliero', 'addTransaction.weekly': 'Settimanale', 'addTransaction.monthly': 'Mensile', 'addTransaction.yearly': 'Annuale', 'addTransaction.endDatePlaceholder': 'Data fine (DD/MM/YYYY)',
  'categorySheet.searchPlaceholder': 'Cerca categorie', 'categorySheet.add': 'Aggiungi "{name}"', 'categorySheet.addHint': 'Salvala come nuova categoria', 'categorySheet.createThisCategory': 'Crea questa categoria per usarla.', 'categorySheet.noneFound': 'Nessuna categoria trovata', 'categorySheet.noneAvailable': 'Nessuna categoria disponibile',
  'accountSheet.noneAvailable': 'Nessun conto disponibile', 'accountSheet.createAccount': 'Crea conto', 'accountSheet.accessibility.createAccount': 'Crea conto', 'accountSheet.accessibility.openAccounts': 'Apri conti', 'amountCalculator.title': 'Importo', 'amountCalculator.accessibility.currency': 'Valuta', 'amountCalculator.accessibility.delete': 'Elimina',
  'quickAccount.newAccount': 'Nuovo conto', 'quickAccount.saveAccount': 'Salva conto', 'quickAccount.intro': 'Crea un conto senza uscire da questa transazione.', 'quickAccount.accountName': 'Nome conto', 'quickAccount.accountNamePlaceholder': 'Nome conto', 'quickAccount.openingBalance': 'Saldo iniziale', 'quickAccount.openingBalanceDate': 'Data saldo iniziale', 'quickAccount.openingBalanceHint': 'Il saldo iniziale viene registrato una sola volta quando il conto viene creato.', 'quickAccount.accountType': 'Tipo di conto', 'quickAccount.validationName': 'Il nome del conto � obbligatorio.', 'quickAccount.validationBalance': 'Inserisci un saldo iniziale valido.', 'quickAccount.type.checking.label': 'Corrente', 'quickAccount.type.checking.description': 'Entrate e spese quotidiane', 'quickAccount.type.savings.label': 'Risparmi', 'quickAccount.type.savings.description': 'Fondo emergenze e obiettivi', 'quickAccount.type.credit.label': 'Credito', 'quickAccount.type.credit.description': 'Carte e debiti a breve termine', 'quickAccount.type.investment.label': 'Investimento', 'quickAccount.type.investment.description': 'Conti di crescita a lungo termine', 'quickAccount.type.cash.label': 'Contanti', 'quickAccount.type.cash.description': 'Portafoglio e piccola cassa',
};

const pt: TranslationMap = {
  'tabs.home': 'In�cio', 'tabs.transactions': 'Transa��es', 'tabs.analytics': 'An�lises', 'tabs.profile': 'Perfil', 'tabs.calendar': 'Calend�rio', 'tabs.accounts': 'Contas', 'tabs.notes': 'Notas', 'tabs.planning': 'Planejamento',
  'common.cancel': 'Cancelar', 'common.delete': 'Excluir', 'common.open': 'Abrir', 'common.done': 'Conclu�do', 'common.save': 'Salvar', 'common.error': 'Erro', 'common.reset': 'Redefinir', 'common.account': 'Conta', 'common.accounts': 'Contas', 'common.currency': 'Moeda', 'common.date': 'Data', 'common.amount': 'Valor', 'common.category': 'Categoria', 'common.description': 'Descri��o', 'common.from': 'De', 'common.to': 'Para', 'common.unknown': 'Desconhecido', 'common.remove': 'Remover',
  'settings.title': 'Configura��es', 'settings.section.notifications': 'Notifica��es', 'settings.section.preferences': 'Prefer�ncias', 'settings.section.profile': 'Perfil', 'settings.section.support': 'Suporte', 'settings.section.privacyBackup': 'Privacidade e backup', 'settings.section.backup': 'Backup', 'settings.budgetAlerts.title': 'Alertas de or�amento', 'settings.budgetAlerts.subtitle': 'Receba notifica��es de or�amento e gastos', 'settings.quickAdd.title': 'Atalho r�pido', 'settings.quickAdd.subtitle': 'Abrir adi��o r�pida pela �rea de notifica��es', 'settings.dailyReminder.title': 'Lembrete di�rio', 'settings.dailyReminder.subtitle': 'Receba um lembrete di�rio para registrar seus gastos', 'settings.reminderTime.title': 'Hor�rio do lembrete', 'settings.reminderTime.subtitle': 'Escolha quando o lembrete di�rio deve aparecer', 'settings.darkMode.title': 'Modo escuro', 'settings.darkMode.subtitle': 'Alternar entre apar�ncia clara e escura', 'settings.currency.title': 'Moeda', 'settings.currency.subtitle': 'Escolha sua moeda principal', 'settings.language.title': 'Idioma', 'settings.autoLock.title': 'Bloqueio autom�tico', 'settings.autoLock.subtitle': 'Bloqueia o app automaticamente ap�s inatividade', 'settings.editProfile.title': 'Editar perfil', 'settings.editProfile.subtitle': 'Atualize os dados de {accountName}', 'settings.addAccount.title': 'Adicionar conta', 'settings.addAccount.subtitle': 'Abra a aba Contas e crie uma nova conta', 'settings.helpSupport.title': 'Ajuda e suporte', 'settings.helpSupport.subtitle': 'Contato, FAQ e ajuda do app', 'settings.backupCenter.title': 'Central de backup', 'settings.backupCenter.subtitle': 'Backups em JSON, CSV e Google Drive', 'settings.privacy.title': 'Privacidade', 'settings.privacy.subtitle': 'Gerencie seguran�a e controles de privacidade', 'settings.clearData.title': 'Limpar dados', 'settings.clearData.subtitle': 'Exclua todas as transa��es, contas e notas', 'settings.autoBackup.title': 'Backup autom�tico', 'settings.autoBackup.subtitle': 'Mantenha os backups do Google Drive atualizados automaticamente', 'settings.lastBackup': '�ltimo backup: {date}', 'settings.currencyUpdated': 'Moeda definida para {code}', 'settings.languageUpdated': 'Idioma definido para {name}', 'autoLock.never': 'Nunca', 'autoLock.immediately': 'Imediatamente', 'autoLock.after1Minute': 'Ap�s 1 minuto', 'autoLock.afterMinutes': 'Ap�s {minutes} minutos',
  'home.metricTooltip.budget': 'Abra Or�amento para revisar os or�amentos ativos.', 'home.metricTooltip.health': 'Abra Sa�de financeira para ver a an�lise completa.', 'home.metricTooltip.goals': 'Abra Planejamento para gerenciar metas e marcos.', 'home.metricTooltip.savings': 'Abra Contas para revisar seus saldos de poupan�a.', 'home.addType.title': 'Adicionar transa��o', 'home.addType.message': 'Escolha um tipo',
  'addTransaction.expense': 'Despesa', 'addTransaction.income': 'Receita', 'addTransaction.transfer': 'Transfer�ncia', 'addTransaction.debt': 'D�vida', 'addTransaction.selectCategory': 'Selecionar categoria', 'addTransaction.selectAccount': 'Selecionar conta', 'addTransaction.enterDescription': 'Digite uma descri��o', 'addTransaction.transferPreview': 'Pr�via da transfer�ncia', 'addTransaction.receiptScanning': 'Leitura de recibo', 'addTransaction.scanReceipt': 'Escanear recibo', 'addTransaction.receiptHint': 'Use o bot�o da c�mera ao lado de Adicionar transa��o para enviar um recibo e preencher os detalhes automaticamente', 'addTransaction.debtDetails': 'Detalhes da d�vida', 'addTransaction.borrowed': 'Recebido emprestado', 'addTransaction.lent': 'Emprestado', 'addTransaction.counterparty': 'Contraparte', 'addTransaction.dueDatePlaceholder': 'Data de vencimento (DD/MM/YYYY)', 'addTransaction.interestRatePlaceholder': 'Taxa de juros (%)', 'addTransaction.addButton': 'Adicionar transa��o', 'addTransaction.useCamera': 'Usar c�mera', 'addTransaction.chooseFromGallery': 'Escolher da galeria', 'addTransaction.debtPayment': 'Pagamento de d�vida', 'addTransaction.recurringTransaction': 'Transa��o recorrente', 'addTransaction.daily': 'Di�rio', 'addTransaction.weekly': 'Semanal', 'addTransaction.monthly': 'Mensal', 'addTransaction.yearly': 'Anual', 'addTransaction.endDatePlaceholder': 'Data final (DD/MM/YYYY)',
  'categorySheet.searchPlaceholder': 'Buscar categorias', 'categorySheet.add': 'Adicionar "{name}"', 'categorySheet.addHint': 'Salvar como nova categoria', 'categorySheet.createThisCategory': 'Crie esta categoria para us�-la.', 'categorySheet.noneFound': 'Nenhuma categoria encontrada', 'categorySheet.noneAvailable': 'Nenhuma categoria dispon�vel',
  'accountSheet.noneAvailable': 'Nenhuma conta dispon�vel', 'accountSheet.createAccount': 'Criar conta', 'accountSheet.accessibility.createAccount': 'Criar conta', 'accountSheet.accessibility.openAccounts': 'Abrir contas', 'amountCalculator.title': 'Valor', 'amountCalculator.accessibility.currency': 'Moeda', 'amountCalculator.accessibility.delete': 'Excluir',
  'quickAccount.newAccount': 'Nova conta', 'quickAccount.saveAccount': 'Salvar conta', 'quickAccount.intro': 'Crie uma conta sem sair desta transa��o.', 'quickAccount.accountName': 'Nome da conta', 'quickAccount.accountNamePlaceholder': 'Nome da conta', 'quickAccount.openingBalance': 'Saldo inicial', 'quickAccount.openingBalanceDate': 'Data do saldo inicial', 'quickAccount.openingBalanceHint': 'O saldo inicial � registrado uma �nica vez quando a conta � criada.', 'quickAccount.accountType': 'Tipo de conta', 'quickAccount.validationName': 'O nome da conta � obrigat�rio.', 'quickAccount.validationBalance': 'Digite um saldo inicial v�lido.', 'quickAccount.type.checking.label': 'Corrente', 'quickAccount.type.checking.description': 'Receitas e gastos di�rios', 'quickAccount.type.savings.label': 'Poupan�a', 'quickAccount.type.savings.description': 'Reserva de emerg�ncia e metas', 'quickAccount.type.credit.label': 'Cr�dito', 'quickAccount.type.credit.description': 'Cart�es e d�vidas de curto prazo', 'quickAccount.type.investment.label': 'Investimento', 'quickAccount.type.investment.description': 'Contas de crescimento de longo prazo', 'quickAccount.type.cash.label': 'Dinheiro', 'quickAccount.type.cash.description': 'Carteira e caixa pequeno',
};

const translations: Record<SupportedLanguageCode, TranslationMap> = { en, es, fr, de, it, pt };

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (_match, key: string) => String(params[key] ?? `{${key}}`));
}

export function translate(key: string, languageCode: string | undefined, params?: TranslationParams): string {
  const normalizedCode = SUPPORTED_LANGUAGES.some((language) => language.code === languageCode)
    ? (languageCode as SupportedLanguageCode)
    : 'en';
  const template = translations[normalizedCode][key] ?? en[key] ?? key;
  return interpolate(template, params);
}

export function useI18n() {
  const { settings } = useTransactionStore();
  const language = settings.language ?? 'en';

  return useMemo(
    () => ({
      language,
      locale: resolveLanguageLocale(language),
      t: (key: string, params?: TranslationParams) => translate(key, language, params),
    }),
    [language]
  );
}
