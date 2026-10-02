// Reading an Indian bank's transaction alert.
//
// The banks don't agree on wording, but they all say the same four things: how
// much, which way, which account, and who it went to. Anything that doesn't say
// all of that — an OTP, a balance summary, a promotion — is left unparsed
// rather than guessed at, because a wrong entry is worse than no entry.

export type ParsedSms = {
  direction: "debit" | "credit";
  amount: number;
  accountTail: string | null;
  merchant: string | null;
  reference: string | null;
  occurredOn: string | null;
};

// "INR 1,745.00", "Rs.3500", "Rs 28,000.50", "₹1,234"
const AMOUNT = /(?:inr|rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)/i;

// Said of money leaving: debited, spent, withdrawn, paid, sent
const DEBIT = /\b(debit(?:ed)?|spent|withdrawn|paid|sent|purchase)\b/i;
// Said of money arriving: credited, received, deposited
const CREDIT = /\b(credit(?:ed)?|received|deposited|refund(?:ed)?)\b/i;

// "A/c XX1234", "a/c no. XXXXXX1234", "A/C **5678", "account ending 1234"
const ACCOUNT =
  /(?:a\/c|ac|acct|account)\s*(?:no\.?|number)?\s*[:\-]?\s*[xX*•]{0,12}(\d{3,6})\b|ending\s+(?:with\s+)?(\d{3,6})\b/i;

// "UPI Ref 123456789012", "Ref No. 1234", "txn id 998877", "IMPS/P2A/123"
const REFERENCE =
  /(?:upi(?:\/| )?ref(?:erence)?(?:\s*no\.?)?|ref(?:erence)?\s*(?:no\.?|id)?|txn\s*(?:id|no\.?)|transaction\s*id)\s*[:\-]?\s*([A-Za-z0-9]{4,30})/i;

// Who the money went to or came from
const TO_FROM =
  /\b(?:to|towards|at|from|by)\s+(?:vpa\s+)?([A-Za-z0-9@._\- &']{3,60}?)(?=\s*[(),.;]|\s+(?:on|ref|upi|txn|avl|bal|a\/c|dated)\b|\s*$)/gi;

// "on 02-10-26", "on 02/10/2026", "on 02Oct26", "on 02-Oct-2026"
const DATE_NUMERIC = /\bon\s+(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/i;
const DATE_NAMED = /\bon\s+(\d{1,2})[-\s]?([A-Za-z]{3})[-\s]?(\d{2,4})\b/i;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// Messages that mention money but aren't a transaction
const NOT_A_TRANSACTION =
  /\b(otp|one[\s-]?time\s*password|do not share|will be debited|is due|due on|minimum amount due|statement|e-?statement|offer|loan offer|pre-?approved|eligible|apply now|cashback up to|reward points|balance is|avl bal(?:ance)? (?:in|for))\b/i;

const pad = (n: number) => String(n).padStart(2, "0");

function readDate(text: string, today: string): string | null {
  const named = DATE_NAMED.exec(text);
  if (named) {
    const month = MONTHS.indexOf(named[2].toLowerCase());
    if (month >= 0) {
      const year = Number(named[3].length === 2 ? `20${named[3]}` : named[3]);
      return `${year}-${pad(month + 1)}-${pad(Number(named[1]))}`;
    }
  }
  const numeric = DATE_NUMERIC.exec(text);
  if (numeric) {
    // Indian banks write day first
    const [, d, m, y] = numeric;
    const year = Number(y.length === 2 ? `20${y}` : y);
    const month = Number(m);
    const day = Number(d);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31)
      return `${year}-${pad(month)}-${pad(day)}`;
  }
  return today;
}

function tidyMerchant(raw: string | undefined) {
  if (!raw) return null;
  const text = raw
    .replace(/\s+/g, " ")
    .replace(/[.,;:]+$/, "")
    .trim();
  if (text.length < 3 || /^[\d.,]+$/.test(text)) return null;
  // "debited by Rs.90 ... to PANI PURI": an amount is not a payee
  if (/^(?:inr|rs\.?|₹)\b/i.test(text)) return null;
  return text.slice(0, 120);
}

// The first candidate that is actually a name, not an amount
function readMerchant(text: string) {
  TO_FROM.lastIndex = 0;
  for (const match of text.matchAll(TO_FROM)) {
    const name = tidyMerchant(match[1]);
    if (name) return name;
  }
  return null;
}

// An OTP or an advert is worth dropping on the floor. A bank message we simply
// couldn't read is worth keeping, so it can be entered by hand and the parser
// improved — the two cases look the same to parseBankSms, so ask separately.
export function looksLikeJunk(body: string) {
  return NOT_A_TRANSACTION.test(body.replace(/\s+/g, " ").trim());
}

export function parseBankSms(body: string, today: string): ParsedSms | null {
  const text = body.replace(/\s+/g, " ").trim();
  if (!text || NOT_A_TRANSACTION.test(text)) return null;

  const amountMatch = AMOUNT.exec(text);
  if (!amountMatch) return null;
  const amount = Number(amountMatch[1].replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  // Whichever word comes first decides the direction: "debited ... credited to
  // the payee" is money leaving
  const debitAt = text.search(DEBIT);
  const creditAt = text.search(CREDIT);
  if (debitAt === -1 && creditAt === -1) return null;
  const direction =
    debitAt === -1 ? "credit" : creditAt === -1 || debitAt < creditAt ? "debit" : "credit";

  const account = ACCOUNT.exec(text);
  const reference = REFERENCE.exec(text);
  return {
    direction,
    amount,
    accountTail: account ? (account[1] ?? account[2] ?? null) : null,
    merchant: readMerchant(text),
    reference: reference ? reference[1].slice(0, 60) : null,
    occurredOn: readDate(text, today),
  };
}

// The same payment often arrives twice — the bank's own SMS and the UPI app's.
// Amount, day and reference identify it; without a reference, the merchant and
// account stand in.
export function smsFingerprint(parsed: ParsedSms, body: string) {
  const key = parsed.reference
    ? `${parsed.amount}|${parsed.occurredOn}|${parsed.reference.toLowerCase()}`
    : `${parsed.amount}|${parsed.occurredOn}|${parsed.direction}|${parsed.accountTail ?? ""}|${
        parsed.merchant?.toLowerCase() ?? body.slice(0, 40).toLowerCase()
      }`;
  return key.replace(/\s+/g, " ").slice(0, 200);
}
