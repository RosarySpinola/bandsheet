export interface Letter {
  subject: string;
  body: string;
}

/**
 * Deterministic Article 7 (Directive (EU) 2023/970) pay-information request. Used as the fallback
 * when the model's draft is missing or does not cite the Directive, and as the reference structure.
 * It never contains the member's own pay figure.
 *
 * Only the Directive itself is cited. National transposing acts are named generically, because we
 * have not verified any country's act or a shorter national deadline.
 */
const LAW_OF: Record<string, string> = { MT: "Maltese", GR: "Greek", DE: "German", FR: "French", IE: "Irish" };

/** Article 7(4): "within a reasonable period of time but in any event within two months from the date on which the request is made". */
export const REPLY_PERIOD = "a reasonable period, and in any event within two months";

export function replyDeadline(country: string): { text: string; law: string } {
  const law = LAW_OF[country];
  return { text: REPLY_PERIOD, law: law ? `as transposed into ${law} law` : "as transposed into national law" };
}

export function templateLetter(grade: string, country = "MT"): Letter {
  const d = replyDeadline(country);
  return {
    subject: "Request for pay information under Article 7 of Directive (EU) 2023/970",
    body: [
      "Dear [HR / Pay Transparency Contact],",
      "",
      `I am writing as a ${grade} at [Employer] [Job title, site] to exercise my right to pay information under Article 7 of Directive (EU) 2023/970 (the Pay Transparency Directive), ${d.law}.`,
      "",
      "Please provide in writing:",
      "1. My individual pay level.",
      "2. The average pay levels, broken down by sex, for the category of workers performing the same work as me or work of equal value to mine.",
      "3. The criteria used to determine pay, pay levels and pay progression for that category.",
      "",
      `Article 7(4) asks for a reply within ${d.text} of this request. I am also content to receive the information through my union representative.`,
      "",
      "Kind regards,",
      "[Your name]",
      "[Date]",
    ].join("\n"),
  };
}

/** Claims we must never let a model add: a national legal-notice citation or a deadline other than the Directive's. */
const UNVERIFIED = /legal notice|\bL\.\s?N\.\s?\d|\b(eight|8)\s+days\b/i;

export function isAcceptableLetter(l: Letter | undefined): l is Letter {
  if (!l) return false;
  const all = `${l.subject} ${l.body}`;
  return /2023\/970/.test(l.body) && /article\s*7/i.test(all) && l.body.length > 200 && !UNVERIFIED.test(all);
}
