import PublicShell, { CtaBand } from "@/components/layout/PublicShell";
import PublicPageTitle from "@/components/layout/PublicPageTitle";
import { LEGAL } from "@/content/legal";
import { ABOUT, CONTACT, PRICING, type ContentDoc } from "@/content/pages";
import { useT } from "@/i18n";

/**
 * Every prose page on the public side: pricing, about, contact and the three
 * legal documents.
 *
 * Six pages, one component, because the difference between them is the text and
 * nothing else. The routes pass an id; the copy is picked by language out of
 * src/content. A page that needs its own layout stops going through here rather
 * than adding an option to it.
 */
const DOCS = {
  pricing: PRICING,
  about: ABOUT,
  contact: CONTACT,
  privacy: LEGAL.privacy,
  terms: LEGAL.terms,
  "aviso-legal": LEGAL["aviso-legal"],
} as const;

export type ProseId = keyof typeof DOCS;

/** The pitch pages close with the "start a club" band. The legal ones don't:
 *  nobody finishes a privacy policy and signs up. */
const WITH_CTA: ProseId[] = ["pricing", "about", "contact"];

export default function ProsePage({ id }: { id: ProseId }) {
  const { t, lang, locale } = useT();
  // Same fallback the dictionaries use: a document a translation hasn't caught
  // up with is shown in Spanish rather than as a blank page.
  const doc: ContentDoc = DOCS[id][lang] ?? DOCS[id].es;

  /* Display size is for pages whose subject *is* the thing on them (see
     publicTitleStyles); a privacy policy is a document you were sent to, and
     it should not open at 60px. Derived from LEGAL rather than a second list,
     so a fourth legal document cannot be added and forgotten here. */
  const isLegal = id in LEGAL;

  return (
    <>
      <PublicPageTitle
        size={isLegal ? "page" : "display"}
        title={doc.title}
        lede={doc.lede}
      >
        {doc.updated && (
          <p className="mt-3 text-caption text-ink-faint">
            {t("public.legal.updated", {
              date: new Date(doc.updated).toLocaleDateString(locale, {
                dateStyle: "long",
              }),
            })}
          </p>
        )}
      </PublicPageTitle>

      <PublicShell>
        {/* A reading measure, not the page width: these are the only pages here
            that get read top to bottom rather than scanned. */}
        <div className="max-w-[68ch]">
          {doc.callout && (
            <p className="wash wash-soft rounded-sheet border border-hairline px-5 py-4 text-h4 font-medium text-ink">
              {doc.callout}
            </p>
          )}

          <div className="mt-8 space-y-8">
            {doc.sections.map((section, i) => (
              <section key={section.heading ?? i}>
                {section.heading && (
                  <h2 className="text-h3 font-semibold tracking-tight text-ink">
                    {section.heading}
                  </h2>
                )}
                {section.body?.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="mt-2 text-body leading-relaxed text-ink-soft"
                  >
                    {paragraph}
                  </p>
                ))}
                {section.bullets && (
                  <ul className="mt-3 space-y-1.5">
                    {section.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="flex gap-2.5 text-body text-ink-soft"
                      >
                        <span aria-hidden className="text-strike">
                          ·
                        </span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          {doc.links && doc.links.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-4">
              {doc.links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-body font-medium text-strike transition-colors duration-150 hover:text-strike-light"
                >
                  {link.label}
                </a>
              ))}
            </div>
          )}
        </div>

        {WITH_CTA.includes(id) && <CtaBand />}
      </PublicShell>
    </>
  );
}
