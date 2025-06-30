/* Updated script based on userscript mentionned below with additional transaction types supported */

// ==UserScript==
// @name        Wealthsimple export transactions as CSV
// @namespace   Violentmonkey Scripts
// @match       https://my.wealthsimple.com/*
// @grant       GM.xmlHttpRequest
// @version     1.1.10
// @license     MIT
// @author      eaglesemanation
// @description Adds export buttons to Activity feed and to Account specific activity. They will export transactions within certain timeframe into CSV, options are "This Month", "Last 3 Month", "All". This should provide better transaction description than what is provided by preexisting CSV export feature.
// @downloadURL https://github.com/fdarveau/wealthsimple-export-transactions/raw/main/wealthsimple-export-transactions-csv.user.js
// ==/UserScript==

const defaultLanguage = "en_CA";
let language = defaultLanguage;

const texts = {
  en_CA: {
    account: "Account",
    accountFundingTransactionNotesPrefix: "Direct deposit",
    accountDebitTransactionNotesPrefix: "Preauthorized debit",
    amount: "Amount",
    ANNUALY: "ANNUAL",
    buttonsLabel: "Export transactions as CSV",
    buttonThisMonth: "This month",
    buttonLast3Months: "Last 3 months",
    buttonAll: "All",
    buyOrderNotesPrefix: "Bought",
    cashback: "Cashback",
    category: "Category",
    cryptoReceived: "Crypto received:",
    cryptoStaked: "Crypto staked:",
    cryptoStakingReward: "Crypto staking reward:",
    date: "Date",
    depositETransferNotesPrefix: "Received INTERAC e-Transfer",
    dividendReceivedNotesPrefix: "Received dividend",
    dividendReinvestedNotesPrefix: "Reinvested dividend into",
    electronicFundsTransferNotesPrefix: "Transfer",
    from: "from",
    fromTimeFrame: "from",
    incentiveBonus: "Promotional bonus",
    institutionalTransferReceived: "Interinstitutional transfer",
    institutionalTransferFeeRefund: "Transfer fee refund",
    wealthSimple: "WealthSimple",
    interestNotes: "Interest",
    MONTHLY: "Monthly",
    nonRegistered: "Non-registered",
    notes: "Notes",
    ONE_TIME: "One time",
    payee: "Payee",
    sellOrderNotesPrefix: "Sold",
    stockLendingInterestNotes: "Stock lending earnings",
    to: "to",
    transferDestination: "Transfered",
    transferSource: "Transfered",
    wealthSimpleCashTransferReceivedNotesPrefix:
      "Received WealthSimple Cash transfer",
    wealthSimpleCashTransferSentNotesPrefix:
      "Sent WealthSimple Cash transfer",
    withdrawalETransferNotesPrefix: "Sent INTERAC e-Transfer",
    withNote: "with note",
    unknown: "Unknown",
    upToTimeFrame: "up to",
  },
  fr_CA: {
    account: "Compte",
    accountFundingTransactionNotesPrefix: "Dépôt direct",
    accountDebitTransactionNotesPrefix: "Débit préautorisé",
    amount: "Montant",
    ANNUALY: "Annuel",
    buttonsLabel: "Exporter les transactions au format CSV",
    buttonThisMonth: "Ce mois-ci",
    buttonLast3Months: "Les 3 derniers mois",
    buttonAll: "Tout",
    buyOrderNotesPrefix: "Acheté:",
    cashback: "Remise en argent",
    category: "Categorie",
    cryptoReceived: "Crypto reçue:",
    cryptoStaked: "Crypto stakée:",
    cryptoStakingReward: "Récompense pour crypto stakée:",
    date: "Date",
    depositETransferNotesPrefix: "Transfert INTERAC reçu",
    dividendReceivedNotesPrefix: "Dividendes reçus",
    dividendReinvestedNotesPrefix: "Dividendes réinvestis dans",
    electronicFundsTransferNotesPrefix: "Transfert",
    from: "de",
    fromTimeFrame: "du",
    incentiveBonus: "Prime de récompense",
    institutionalTransferReceived: "Transfert interinstitution",
    institutionalTransferFeeRefund: "Remboursement des frais de transfert",
    wealthSimple: "WealthSimple",
    interestNotes: "Intérêt",
    MONTHLY: "Mensuel",
    nonRegistered: "Non enregistré",
    notes: "Notes",
    ONE_TIME: "Unique",
    payee: "Bénéficiaire",
    sellOrderNotesPrefix: "Vendu:",
    stockLendingInterestNotes: "Gains des prêts d'actions",
    to: "à",
    transferDestination: "Transferé",
    transferSource: "Transferé",
    wealthSimpleCashTransferReceivedNotesPrefix:
      "Transfert WealthSimple Cash reçu",
    wealthSimpleCashTransferSentNotesPrefix:
      "Transfert WealthSimple Cash envoyé",
    withdrawalETransferNotesPrefix: "Transfert INTERAC envoyé",
    withNote: "avec la note",
    unknown: "Inconnu",
    upToTimeFrame: "jusqu'au",
  },
};


/**
 * Refreshes the language to make sure texts are shown in the correct language
 * 
 * @param {Date} date
 */
function refreshLanguage() {
  language = localStorage.getItem("ls.locale").replace(/"/g, "");
  if (!texts[language]) {
    language = defaultLanguage;
  }
}

/**
 * @callback ReadyPredicate
 * @returns {boolean}
 */

/**
 * @typedef {Object} PageInfo
 * @property {"account-details" | "activity" | null} pageType
 * @property {HTMLElement?} anchor - Element to which buttons will be "attached". Buttons should be inserted before it.
 * @property {ReadyPredicate?} readyPredicate - Verifies if ready to insert
 */

/**
 * Figures out which page we're currently on and where to attach buttons. Should not do any queries,
 * because it gets spammed executed by MutationObserver.
 *
 * @returns {PageInfo}
 */
function getPageInfo() {
  /**
   * @type PageInfo
   */
  refreshLanguage();
  let emptyInfo = {
    pageType: null,
    anchor: null,
    readyPredicate: null,
    accountsInfo: null,
  };
  let info = structuredClone(emptyInfo);

  let pathParts = window.location.pathname.split("/");
  if (pathParts.length === 4 && pathParts[2] === "account-details") {
    const actionsMenuSelector = `div:has(>div>div>button[data-qa="account-actions-menu"])`;

    info.pageType = pathParts[2];
    let anchor = document.querySelectorAll(actionsMenuSelector);
    if (anchor.length !== 1) {
      return emptyInfo;
    }
    info.anchor = anchor[0];
    info.readyPredicate = () => info.anchor.parentNode.childNodes.length === 2;
  } else  if (pathParts.length === 3 && (pathParts[2] === "activity")) {
    // All classes within HTML have been obfuscated/minified, using icons as a starting point, in hope that the rest of the layout doesn't change much.
    const buttonsContainerQuery = "main > div:has(h1)"

    info.pageType = pathParts[2];
    let anchor = document.querySelectorAll(buttonsContainerQuery);
    if (anchor.length !== 1) {
      return emptyInfo;
    }
    info.anchor = anchor[0];
    info.readyPredicate = () => info.anchor.querySelectorAll("h2").length >= 2;
  } else {
    // Didn't match any expected page
    return emptyInfo;
  }

  return info;
}

// ID for quickly verifying if buttons were already injected
const exportCsvId = "export-transactions-csv";

/**
 * Keeps button shown after rerenders and href changes
 *
 * @returns {Promise<void>}
 */
async function keepButtonShown() {
  // Early exit, to avoid unnecessary requests if already injected
  if (document.querySelector(`div#${exportCsvId}`)) {
    return;
  }

  const pageInfo = getPageInfo();
  if (!pageInfo.pageType) {
    return;
  }
  if (!(pageInfo.readyPredicate && pageInfo.readyPredicate())) {
    return;
  }

  addButtons(pageInfo);
}

(async function () {
  const observer = new MutationObserver(async (mutations) => {
    for (const _ of mutations) {
      await keepButtonShown();
    }
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  // Try running on load if there are no mutations for some reason
  window.addEventListener("load", async () => {
    await keepButtonShown();
  });
})();

/**
 * Stub, just forcing neovim to corectly highlight CSS syntax in literal
 */
function css(str) {
  return str;
}

const stylesheet = new CSSStyleSheet();
stylesheet.insertRule(css`
  .export-csv-button:hover {
    color: rgb(50, 48, 47);
    background-image: linear-gradient(
      0deg,
      rgba(0, 0, 0, 0.04) 0%,
      rgba(0, 0, 0, 0.04) 100%
    );
  }
`);
stylesheet.insertRule(css`
  .export-csv-button {
    display: inline-flex;
    background: rgb(255, 255, 255);
    border: 1px solid rgb(228, 226, 225);
    border-radius: 4.5em;
    font-size: 16px;
    padding-left: 1em;
    padding-right: 1em;
    font-family: "FuturaPT-Demi";
    font-weight: unset;
  }
`);

/**
 * Attaches button row to anchor element. Should be syncronous to avoid attaching row twice, because Mutex is not cool enough for JS?
 *
 * @param {PageInfo} pageInfo
 * @returns {void}
 */
function addButtons(pageInfo) {
  document.adoptedStyleSheets = [stylesheet];

  let buttonRow = document.createElement("div");
  buttonRow.id = exportCsvId;
  buttonRow.style.display = "flex";
  buttonRow.style.alignItems = "baseline";
  buttonRow.style.gap = "1em";
  buttonRow.style.marginLeft = "auto";

  let buttonRowText = document.createElement("span");
  buttonRowText.innerText = texts[language].buttonsLabel;
  buttonRow.appendChild(buttonRowText);

  const now = new Date();
  const buttons = [
    {
      text: texts[language].buttonThisMonth,
      fromDate: new Date(now.getFullYear(), now.getMonth(), 1),
    },
    {
      text: texts[language].buttonLast3Months,
      fromDate: new Date(now.getFullYear(), now.getMonth() - 3, 1),
    },
    {
      text: texts[language].buttonAll,
      fromDate: null,
    },
  ];

  for (const button of buttons) {
    let exportButton = document.createElement("button");
    exportButton.innerText = button.text;
    exportButton.className = "export-csv-button";
    exportButton.onclick = async () => {
      console.log("Fetching account details");
      let accountsInfo = await accountFinancials();

      let transactions = [];

      console.log("Fetching transactions");
      if (pageInfo.pageType === "account-details") {
        let pathParts = window.location.pathname.split("/");
        accountIds = [pathParts[3]];
        transactions = await activityList(accountIds, button.fromDate);
      } else if (pageInfo.pageType === "activity") {
        let params = new URLSearchParams(window.location.search);
        let ids_param = params.get("account_ids");
        if (ids_param) {
          accountIds = ids_param.split(",");
        } else {
          accountIds = accountsInfo.map((acc) => acc.id);
        }
        transactions = await activityFeedItems(accountIds, button.fromDate);
      }

      let blobs = await transactionsToCsvBlobs(transactions);
      saveBlobsToFiles(blobs, accountsInfo, button.fromDate);
    };

    buttonRow.appendChild(exportButton);
  }

  if (pageInfo.anchor.querySelector("h1") !== null) {
    pageInfo.anchor.querySelector("h1").parentNode.appendChild(buttonRow)
  } else {
    let anchorParent = pageInfo.anchor.parentNode;
    anchorParent.insertBefore(buttonRow, pageInfo.anchor);
    anchorParent.style.gap = "1em";
    pageInfo.anchor.style.marginLeft = "0";
  }
}

/**
 * @typedef {Object} OauthCookie
 * @property {string} access_token
 * @property {string} identity_canonical_id
 */

/**
 * @returns {OauthCookie}
 */
function getOauthCookie() {
  let decodedCookie = decodeURIComponent(document.cookie).split(";");
  for (let cookieKV of decodedCookie) {
    if (cookieKV.indexOf("_oauth2_access_v2") !== -1) {
      let [_, val] = cookieKV.split("=");
      return JSON.parse(val);
    }
  }
  return null;
}

/**
 * Subset of ActivityFeedItem type in GraphQL API
 *
 * @typedef {Object} Transaction
 * @property {string} accountId
 * @property {string} externalCanonicalId
 * @property {string} amount
 * @property {string} amountSign
 * @property {string} occurredAt
 * @property {string} opposingAccountId
 * @property {string} type
 * @property {string} subType
 * @property {string} eTransferEmail
 * @property {string} eTransferName
 * @property {string} p2pHandle
 * @property {string} p2pMessage
 * @property {string} assetSymbol
 * @property {string} assetQuantity
 * @property {string} aftOriginatorName
 * @property {string} aftTransactionCategory
 * @property {string} billPayCompanyName
 * @property {string} billPayPayeeNickname
 * @property {string} frequency
 * @property {string} spendMerchant
 */

const activityFeedItemFragment = `
    fragment Activity on ActivityFeedItem {
      accountId
      externalCanonicalId
      amount
      amountSign
      occurredAt
      opposingAccountId
      type
      subType
      eTransferEmail
      eTransferName
      p2pHandle
      p2pMessage
      assetSymbol
      assetQuantity
      aftOriginatorName
      aftTransactionCategory
      billPayCompanyName
      billPayPayeeNickname
      frequency,
      spendMerchant
    }
  `;

const fetchActivityListQuery = `
    query FetchActivityList(
      $first: Int!
      $cursor: Cursor
      $accountIds: [String!]
      $types: [ActivityFeedItemType!]
      $subTypes: [ActivityFeedItemSubType!]
      $endDate: Datetime
      $securityIds: [String]
      $startDate: Datetime
      $legacyStatuses: [String]
    ) {
      activities(
        first: $first
        after: $cursor
        accountIds: $accountIds
        types: $types
        subTypes: $subTypes
        endDate: $endDate
        securityIds: $securityIds
        startDate: $startDate
        legacyStatuses: $legacyStatuses
      ) {
        edges {
          node {
            ...Activity
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

/**
 * API used by account specific activity view.
 * Seems like it's just outdated API, will use it just as safetyguard
 *
 * @returns {Promise<[Transaction]>}
 */
async function activityList(accountIds, startDate) {
  let transactions = [];
  let hasNextPage = true;
  let cursor = undefined;
  while (hasNextPage) {
    let respJson = await GM.xmlHttpRequest({
      url: "https://my.wealthsimple.com/graphql",
      method: "POST",
      responseType: "json",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${getOauthCookie().access_token}`,
      },
      data: JSON.stringify({
        operationName: "FetchActivityList",
        query: `
              ${fetchActivityListQuery}
              ${activityFeedItemFragment}
          `,
        variables: {
          first: 100,
          cursor,
          startDate,
          endDate: new Date().toISOString(),
          accountIds,
        },
      }),
    });

    if (respJson.status !== 200) {
      throw `Failed to fetch transactions: ${respJson.responseText}`;
    }
    let resp = JSON.parse(respJson.responseText);
    let activities = resp.data.activities;
    hasNextPage = activities.pageInfo.hasNextPage;
    cursor = activities.pageInfo.endCursor;
    transactions = transactions.concat(activities.edges.map((e) => e.node));
  }
  return transactions;
}

const fetchActivityFeedItemsQuery = `
    query FetchActivityFeedItems(
      $first: Int
      $cursor: Cursor
      $condition: ActivityCondition
      $orderBy: [ActivitiesOrderBy!] = OCCURRED_AT_DESC
    ) {
      activityFeedItems(
        first: $first
        after: $cursor
        condition: $condition
        orderBy: $orderBy
      ) {
        edges {
          node {
            ...Activity
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

/**
 * API used by activity feed page.
 * @returns {Promise<[Transaction]>}
 */
async function activityFeedItems(accountIds, startDate) {
  let transactions = [];
  let hasNextPage = true;
  let cursor = undefined;
  while (hasNextPage) {
    let respJson = await GM.xmlHttpRequest({
      url: "https://my.wealthsimple.com/graphql",
      method: "POST",
      responseType: "json",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${getOauthCookie().access_token}`,
      },
      data: JSON.stringify({
        operationName: "FetchActivityFeedItems",
        query: `
              ${fetchActivityFeedItemsQuery}
              ${activityFeedItemFragment}
          `,
        variables: {
          first: 100,
          cursor,
          condition: {
            startDate,
            accountIds,
            unifiedStatuses: ["COMPLETED"],
          },
        },
      }),
    });

    if (respJson.status !== 200) {
      throw `Failed to fetch transactions: ${respJson.responseText}`;
    }
    let resp = JSON.parse(respJson.responseText);
    let activities = resp.data.activityFeedItems;
    hasNextPage = activities.pageInfo.hasNextPage;
    cursor = activities.pageInfo.endCursor;
    transactions = transactions.concat(activities.edges.map((e) => e.node));
  }
  return transactions;
}

const fetchAllAccountFinancialsQuery = `
    query FetchAllAccountFinancials(
      $identityId: ID!
      $pageSize: Int = 25
      $cursor: String
    ) {
      identity(id: $identityId) {
        id
        accounts(filter: {}, first: $pageSize, after: $cursor) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            cursor
            node {
              ...Account
            }
          }
        }
      }
    }
  
    fragment Account on Account {
      id
      unifiedAccountType
      nickname
    }
  `;

/**
 * @typedef {Object} AccountInfo
 * @property {string} id
 * @property {string} nickname
 */

/**
 * Query all accounts
 * @returns {Promise<[AccountInfo]>}
 */
async function accountFinancials() {
  let oauthCookie = getOauthCookie();
  let respJson = await GM.xmlHttpRequest({
    url: "https://my.wealthsimple.com/graphql",
    method: "POST",
    responseType: "json",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${oauthCookie.access_token}`,
    },
    data: JSON.stringify({
      operationName: "FetchAllAccountFinancials",
      query: fetchAllAccountFinancialsQuery,
      variables: {
        identityId: oauthCookie.identity_canonical_id,
        pageSize: 25,
      },
    }),
  });

  if (respJson.status !== 200) {
    throw `Failed to fetch account info: ${respJson.responseText}`;
  }
  let resp = JSON.parse(respJson.responseText);
  const self_directed_re = /^SELF_DIRECTED_(?<name>.*)/;
  let accounts = resp.data.identity.accounts.edges.map((e) => {
    let nickname = e.node.nickname;
    if (!nickname) {
      if (e.node.unifiedAccountType === "CASH") {
        nickname = "Cash";
      } else if (self_directed_re.test(e.node.unifiedAccountType)) {
        let found = e.node.unifiedAccountType.match(self_directed_re);
        nickname = found.groups.name;
        if (nickname === "CRYPTO") {
          nickname = "Crypto";
        } else if (nickname === "NON_REGISTERED") {
          nickname = texts[language].nonRegistered;
        }
      } else {
        nickname = texts[language].unknown;
      }
    }
    return {
      id: e.node.id,
      nickname,
    };
  });
  return accounts;
}

/**
 * @typedef {Object} InstitutionalTransfer
 * @property {string} institutionName
 * @property {String} transferStatus
 * @property {string} redactedInstitutionAccountNumber
 */

const fetchInstitutionalTransferQuery = `
query FetchInstitutionalTransfer($id: ID!) {
  accountTransfer(id: $id) {
    ...InstitutionalTransfer
    __typename
  }
}

fragment InstitutionalTransfer on InstitutionalTransfer {
  institutionName: institution_name
  transferStatus: external_state
  redactedInstitutionAccountNumber: redacted_institution_account_number
}
`;

/**
 * @param {string} transferId
 * @returns {Promise<InstitutionalTransfer>}
 */
async function institutionalTransfer(transferId) {
  let respJson = await GM.xmlHttpRequest({
    url: "https://my.wealthsimple.com/graphql",
    method: "POST",
    responseType: "json",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${getOauthCookie().access_token}`,
    },
    data: JSON.stringify({
      operationName: "FetchInstitutionalTransfer",
      query: fetchInstitutionalTransferQuery,
      variables: {
        id: transferId,
      },
    }),
  });

  if (respJson.status !== 200) {
    throw `Failed to fetch transfer info: ${respJson.responseText}`;
  }
  let resp = JSON.parse(respJson.responseText);
  return resp.data.accountTransfer;
}

/**
 * @typedef {Object} TransferInfo
 * @property {string} id
 * @property {string} status
 * @property {{"bankAccount": BankInfo}} source
 * @property {{"bankAccount": BankInfo}} destination
 */

/**
 * @typedef {Object} BankInfo
 * @property {string} accountName
 * @property {string} accountNumber
 * @property {string} nickname
 */

const fetchFundsTransferQuery = `
    query FetchFundsTransfer($id: ID!) {
      fundsTransfer: funds_transfer(id: $id, include_cancelled: true) {
        id
        status
        source {
          ...BankAccountOwner
        }
        destination {
          ...BankAccountOwner
        }
      }
    }
  
    fragment BankAccountOwner on BankAccountOwner {
      bankAccount: bank_account {
        id
        institutionName: institution_name
        nickname
        ...CaBankAccount
        ...UsBankAccount
      }
    }
  
    fragment CaBankAccount on CaBankAccount {
      accountName: account_name
      accountNumber: account_number
    }
  
    fragment UsBankAccount on UsBankAccount {
      accountName: account_name
      accountNumber: account_number
    }
  `;

/**
 * @param {string} transferId
 * @returns {Promise<TransferInfo>}
 */
async function fundsTransfer(transferId) {
  let respJson = await GM.xmlHttpRequest({
    url: "https://my.wealthsimple.com/graphql",
    method: "POST",
    responseType: "json",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${getOauthCookie().access_token}`,
    },
    data: JSON.stringify({
      operationName: "FetchFundsTransfer",
      query: fetchFundsTransferQuery,
      variables: {
        id: transferId,
      },
    }),
  });

  if (respJson.status !== 200) {
    throw `Failed to fetch transfer info: ${respJson.responseText}`;
  }
  let resp = JSON.parse(respJson.responseText);
  return resp.data.fundsTransfer;
}

/**
 * @param {[Transaction]} transactions
 * @returns {Promise<{[string]: Blob}>}
 */
async function transactionsToCsvBlobs(transactions) {
  let accTransactions = transactions.reduce((acc, transaction) => {
    const id = transaction.accountId;
    (acc[id] = acc[id] || []).push(transaction);
    return acc;
  }, {});
  let accBlobs = {};
  for (let acc in accTransactions) {
    accBlobs[acc] = await accountTransactionsToCsvBlob(accTransactions[acc]);
  }
  return accBlobs;
}

/**
 * @param {[Transaction]} transactions
 * @returns {Promise<Blob>}
 */
async function accountTransactionsToCsvBlob(transactions) {
  let csv = `${texts[language].date}, ${texts[language].account}, ${texts[language].payee},${texts[language].notes},${texts[language].category},${texts[language].amount}\n`;
  for (const transaction of transactions) {
    let date = new Date(transaction.occurredAt);
    // JS Date type is absolutly horible, I hope Temporal API will be better
    let dateStr = `${date.getFullYear()}-${
      date.getMonth() + 1
    }-${date.getDate()}`;

    let account = getAccountLabel(transaction.accountId);

    let payee = null;
    let notes = null;
    let type = transaction.type;
    if (transaction.subType) {
      type = `${type}/${transaction.subType}`;
    }

    // Most transactions in Wealthsimple don't have category, skipping
    let category = "";
    let info = null;
    let bankInfo = null;

    switch (type) {
      case "INTEREST":
        payee = texts[language].wealthSimple;
        notes = texts[language].interestNotes;
      case "INTEREST/FPL_INTEREST":
        payee = texts[language].wealthSimple;
        notes = texts[language].stockLendingInterestNotes;
        break;
      case "WITHDRAWAL/E_TRANSFER":
        payee = transaction.eTransferEmail;
        notes = `${texts[language].withdrawalETransferNotesPrefix} ${texts[language].to} ${transaction.eTransferName}`;
        break;
      case "DEPOSIT/E_TRANSFER":
      case "DEPOSIT/E_TRANSFER_FUNDING":
        payee = transaction.eTransferEmail;
        notes = `${texts[language].depositETransferNotesPrefix} ${texts[language].from} ${transaction.eTransferName}`;
        break;
      case "DIVIDEND/DIY_DIVIDEND":
        payee = transaction.assetSymbol;
        notes = `${texts[language].dividendReceivedNotesPrefix} ${texts[language].from} ${transaction.assetSymbol}`;
        break;
      case "DIY_BUY/DIVIDEND_REINVESTMENT":
        payee = transaction.assetSymbol;
        notes = `${texts[language].dividendReinvestedNotesPrefix} ${transaction.assetQuantity} ${transaction.assetSymbol}`;
        break;
      case "DIY_BUY/MARKET_ORDER":
      case "DIY_BUY/LIMIT_ORDER":
        payee = transaction.assetSymbol;
        notes = `${texts[language].buyOrderNotesPrefix} ${transaction.assetQuantity} ${transaction.assetSymbol}`;
        break;
      case "DIY_SELL/MARKET_ORDER":
      case "DIY_SELL/LIMIT_ORDER":
        payee = transaction.assetSymbol;
        notes = `${texts[language].sellOrderNotesPrefix} ${transaction.assetQuantity} ${transaction.assetSymbol}`;
        break;
      case "SPEND/PREPAID":
        payee = transaction.spendMerchant;
        notes = payee;
        break;
      case "WITHDRAWAL/BILL_PAY":
        payee = transaction.billPayPayeeNickname || transaction.billPayCompanyName;
        notes = `${payee} (${texts[language][transaction.frequency]})`;
        category = transaction.aftTransactionCategory;
        break;
      case "WITHDRAWAL/AFT":
        payee = transaction.aftOriginatorName;
        notes = `${texts[language].accountDebitTransactionNotesPrefix} ${texts[language].to} ${transaction.aftOriginatorName}`;
        category = transaction.aftTransactionCategory;
        break;
      case "DEPOSIT/AFT":
        payee = transaction.aftOriginatorName;
        notes = `${texts[language].accountFundingTransactionNotesPrefix} ${texts[language].from} ${transaction.aftOriginatorName}`;
        category = transaction.aftTransactionCategory;
        break;
      case "WITHDRAWAL/EFT":
        info = await fundsTransfer(transaction.externalCanonicalId);
        bankInfo = info.destination.bankAccount;
        payee = `${bankInfo.institutionName} ${
          bankInfo.nickname || bankInfo.accountName
        } ${bankInfo.accountNumber || ""}`;
        notes = `${texts[language].electronicFundsTransferNotesPrefix} ${texts[language].to} ${payee}`;
        break;
      case "DEPOSIT/EFT":
        info = await fundsTransfer(transaction.externalCanonicalId);
        bankInfo = info.source.bankAccount;
        payee = `${bankInfo.institutionName} ${
          bankInfo.nickname || bankInfo.accountName
        } ${bankInfo.accountNumber || ""}`;
        notes = `${texts[language].electronicFundsTransferNotesPrefix} ${texts[language].from} ${payee}`;
        break;
      case "P2P_PAYMENT/SEND_RECEIVED":
      case "P2P_PAYMENT/REQUEST":
        payee = transaction.p2pHandle;
        notes = `${texts[language].wealthSimpleCashTransferReceivedNotesPrefix} ${texts[language].from} ${transaction.p2pHandle}`;
        if (transaction.p2pMessage) {
          notes += ` ${texts[language].withNote} : ${transaction.p2pMessage}`;
        }
        break;
      case "P2P_PAYMENT/SEND":
        payee = transaction.p2pHandle;
        notes = `${texts[language].wealthSimpleCashTransferSentNotesPrefix} ${texts[language].to} ${transaction.p2pHandle}`;
        if (transaction.p2pMessage) {
          notes += ` ${texts[language].withNote} : ${transaction.p2pMessage}`;
        }
        break;
      case "CRYPTO_TRANSFER/TRANSFER_IN":
        payee = transaction.assetSymbol;
        notes = `${texts[language].cryptoReceived} ${transaction.assetQuantity} ${transaction.assetSymbol}`;
        break;
      case "CRYPTO_STAKING_ACTION/STAKE":
      case "CRYPTO_STAKING_ACTION/AUTO_STAKE":
        payee = transaction.assetSymbol;
        notes = `${texts[language].cryptoStaked} ${transaction.assetQuantity} ${transaction.assetSymbol}`;
        break;
      case "CRYPTO_STAKING_REWARD":
        payee = transaction.assetSymbol;
        notes = `${texts[language].cryptoStakingReward} ${transaction.assetQuantity} ${transaction.assetSymbol}`;
        break;
      case "CRYPTO_BUY/MARKET_ORDER":
      case "CRYPTO_BUY/LIMIT_ORDER":
        payee = transaction.assetSymbol;
        notes = `${texts[language].buyOrderNotesPrefix} ${transaction.assetQuantity} ${transaction.assetSymbol}`;
        break;
      case "INTERNAL_TRANSFER/SOURCE":
        payee = getAccountLabel(transaction.opposingAccountId);
        notes = `${texts[language].transferSource} ${texts[language].to} ${payee}`;
        break;
      case "INTERNAL_TRANSFER/DESTINATION":
        payee = getAccountLabel(transaction.opposingAccountId);
        notes = `${texts[language].transferDestination} ${texts[language].from} ${payee}`;
        break;
      case "PROMOTION/INCENTIVE_BONUS":
        payee = texts[language].wealthSimple;
        notes = `${texts[language].incentiveBonus}`;
        break;
      case "INSTITUTIONAL_TRANSFER_INTENT/TRANSFER_IN":
        info = await institutionalTransfer(transaction.externalCanonicalId);
        payee = `${info.institutionName} - ***${info.redactedInstitutionAccountNumber}`;
        notes = `${texts[language].institutionalTransferReceived} ${texts[language].from} ${payee}`;
        break;
      case "REFUND/TRANSFER_FEE_REFUND":
        payee = texts[language].wealthSimple;
        notes = `${texts[language].institutionalTransferFeeRefund}`;
        break;
      case "REIMBURSEMENT/CASHBACK":
        payee = texts[language].wealthSimple;
        notes = `${texts[language].cashback}`;
        break;
      default:
        console.error(
          `${dateStr} transaction [${type}] has unexpected type. Object logged below. Skipping`
        );
        console.log(transaction);
        continue;
    }

    let amount = transaction.amount;
    if (transaction.amountSign === "negative") {
      amount = `-${amount}`;
    }

    let entry = `"${dateStr}", ${account},"${payee}","${notes}","${category}","${amount}"`;
    csv += `${entry}\n`;
  }
  return new Blob([csv], { type: "text/csv;charset=utf-8" });
}

/**
 * @param {{[string]: Blob}} accountBlobs
 * @param {[AccountInfo]} accountsInfo
 * @param {Date?} fromDate
 */
async function saveBlobsToFiles(accountBlobs, accountsInfo, fromDate) {
  let accToName = accountsInfo.reduce((accum, info) => {
    accum[info.id] = info.nickname;
    return accum;
  }, {});

  for (let acc in accountBlobs) {
    let blobUrl = URL.createObjectURL(accountBlobs[acc]);

    let timeFrame = "";
    if (fromDate) {
      timeFrame += `${texts[language].fromTimeFrame} ${formatDate(fromDate)} `;
    }
    timeFrame += `${texts[language].upToTimeFrame} ${formatDate(new Date())}`;

    let link = document.createElement("a");
    link.setAttribute(
      "href",
      "data:text/csv;charset=utf-8,%EF%BB%BF" +
        encodeURI(await accountBlobs[acc].text())
    );
    link.setAttribute(
      "download",
      `Wealthsimple ${accToName[acc]} Transactions ${timeFrame}.csv`
    );
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  }
}

/**
 * Returns a date formatted as yyyy-MM-dd
 * 
 * @param {Date} date
 */
function formatDate(date) {
  return `${date.getFullYear()}-${(date.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;
}

/**
 * Returns a label for the accound ID received
 * 
 * @param {string} accountId
 */
function getAccountLabel(accountId) {
  let accountIdParts = accountId.split('-');
  let accountLabel = accountIdParts[0];
  if (accountId.startsWith('non-registered')) {
    accountLabel = 'non-registered';
    if (accountIdParts.length >= 2) {
      accountLabel += ` ${accountIdParts[2]}`;
    }
  }
  if (accountIdParts[1] === 'cash') accountLabel = 'cash';
  return accountLabel.toUpperCase();
}
