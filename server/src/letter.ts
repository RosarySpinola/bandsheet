export interface Letter {
  subject: string;
  body: string;
}

/**
 * Deterministic Article 7 (Directive (EU) 2023/970) pay-information request. Used as the fallback
 * when the model's draft is missing or does not cite the Directive, and as the reference structure.
 * It never contains the member's own pay figure.
 */
export const MALTA_LAW = "the Equal Pay (Transparency and Reporting) Regulations, 2026 (Legal Notice 173 of 2026)";

/** Where the Directive is already law with a shorter deadline, say so; otherwise use the Directive's own two months. */
export function replyDeadline(country: string): { text: string; law: string } {
  return country === "MT"
    ? { text: "eight days", law: `as transposed in Malta by ${MALTA_LAW}` }
    : { text: "two months", law: "as transposed in [Member State]" };
}

export function templateLetter(grade: string, country = "MT"): Letter {
  const d = replyDeadline(country);
  return {
    subject: "Request for pay information under Article 7 of Directive (EU) 2023/970",
    body: [
      "Dear [HR / Pay Transparency Contact],",
      "",
      `I am writing as a ${grade} at [Employer] [Job title, site] to exercise my right to pay information under Article 7 of Directive (EU) 2023/970 on pay transparency, ${d.law}.`,
      "",
      "Please provide in writing:",
      "1. My individual pay level.",
      "2. The average pay levels, broken down by sex, for the category of workers performing the same work as me or work of equal value to mine.",
      "3. The criteria used to determine pay, pay levels and pay progression for that category.",
      "",
      `Under Article 7 I expect a reply within ${d.text} of this request. I am also content to receive the information through my union representative.`,
      "",
      "Kind regards,",
      "[Your name]",
      "[Date]",
    ].join("\n"),
  };
}

export function isAcceptableLetter(l: Letter | undefined): l is Letter {
  if (!l) return false;
  return /2023\/970/.test(l.body) && /article\s*7/i.test(`${l.subject} ${l.body}`) && l.body.length > 200;
}
