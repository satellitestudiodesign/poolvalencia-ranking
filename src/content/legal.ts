import type { Lang } from "@/i18n";

/**
 * The three legal documents, as prose rather than as dictionary keys.
 *
 * ponytail: long-form copy lives here and not in src/i18n/*.json on purpose.
 * The dictionaries are UI strings — a label a component asks for by key — and
 * they are checked for key parity across three files. A privacy policy is one
 * document per language that gets read and edited as a whole, so it is one
 * object per language, and the pages render it with a single component.
 *
 * The identity fields below are placeholders. LSSI-CE art. 10 and GDPR arts.
 * 13–14 both require a real, identifiable operator: publishing these pages with
 * `[…]` still in them is worse than not publishing them at all. Fill OPERATOR
 * before the first non-you signup, and have a Spanish adviser read the result —
 * this text is drafted from model knowledge, not from a lawyer, and the content
 * is yours once it is live.
 */
export const OPERATOR = {
  /** Autónomo's full name, or the SL's razón social. */
  legalName: "[NOMBRE Y APELLIDOS / RAZÓN SOCIAL]",
  nif: "[NIF / CIF]",
  address: "[DIRECCIÓN POSTAL COMPLETA]",
  /** Registro Mercantil data. Empty for an autónomo — the section drops out. */
  registry: "",
} as const;

/** The one mailbox the public pages hand out. TODO: confirm it exists and is
 *  read before these pages go live — a contact page pointing at a mailbox
 *  nobody opens is worse than no contact page. */
export const CONTACT_EMAIL = "hola@poolclubs.app";

/** Every provider that processes data on our behalf, with where it runs. Shown
 *  on the privacy page and required by art. 28. Region strings are per-project
 *  facts: check the Supabase project's actual region before publishing. */
export const SUBPROCESSORS = [
  { name: "Supabase", role: "database, authentication, storage", region: "EU" },
  { name: "Netlify", role: "hosting, CDN", region: "US/global" },
  { name: "Google", role: "sign-in with Google (OAuth)", region: "US/global" },
  {
    name: "Cloudflare",
    role: "cookieless audience measurement (Web Analytics)",
    region: "US/global",
  },
  {
    name: "OpenStreetMap / Photon",
    role: "address search on maps",
    region: "EU",
  },
] as const;

export type LegalSection = { heading: string; body: string[] };

export type LegalDoc = {
  title: string;
  /** ISO date, rendered in the reader's locale. Bump it when the text changes. */
  updated: string;
  lede: string;
  sections: LegalSection[];
};

export type LegalDocId = "privacy" | "terms" | "aviso-legal";

const UPDATED = "2026-09-04";

const providerList = SUBPROCESSORS.map(
  (p) => `${p.name} - ${p.role} (${p.region})`,
).join(" · ");

const privacyEs: LegalDoc = {
  title: "Política de privacidad",
  updated: UPDATED,
  lede: "Qué datos trata PoolClubs, para qué, quién los ve y cómo ejercer tus derechos.",
  sections: [
    {
      heading: "1. Responsable",
      body: [
        `${OPERATOR.legalName}, NIF ${OPERATOR.nif}, con domicilio en ${OPERATOR.address}. Contacto: ${CONTACT_EMAIL}.`,
        "Para los datos de los socios de un club, el club es el responsable y PoolClubs actúa como encargado del tratamiento: tratamos esos datos siguiendo sus instrucciones y para prestarle el servicio.",
      ],
    },
    {
      heading: "2. Qué datos tratamos",
      body: [
        "Cuenta: correo electrónico e identificador del proveedor con el que inicias sesión (Google), más la fecha de alta.",
        "Perfil: nombre con el que apareces en tu club, foto si la subes, categoría y clubes a los que perteneces.",
        "Actividad deportiva: partidos, resultados, ranking Elo y diario, retos, torneos, ejercicios registrados, reacciones y comentarios.",
        "Club: nombre, escudo, color, dirección y coordenadas si el administrador las añade.",
        "Técnicos: registros de error y del servidor necesarios para mantener el servicio en funcionamiento.",
        "No tratamos datos de pago: hoy no hay ningún plan de pago.",
      ],
    },
    {
      heading: "3. Para qué y con qué base jurídica",
      body: [
        "Prestar el servicio (cuenta, ranking, partidos, torneos): ejecución del contrato.",
        "Mantener el servicio seguro y funcionando, incluidos registros de error: interés legítimo.",
        "Publicar el club, los jugadores y los resultados en las páginas públicas: interés legítimo del club en darse a conocer, con la posibilidad de dejar de aparecer en cualquier momento (ver punto 4).",
        "Cumplir obligaciones legales cuando existan: obligación legal.",
      ],
    },
    {
      heading: "4. Quién los ve",
      body: [
        "Dentro de la aplicación, cada club ve solo lo suyo: la base de datos aplica seguridad a nivel de fila y una consulta desde otro club no devuelve nada.",
        "Fuera de la aplicación, un club puede publicar su página. Si está publicada, cualquiera puede ver el nombre del club, su ranking, sus resultados, sus torneos y el nombre y la foto de los jugadores que estén marcados como públicos. El código de invitación nunca se publica.",
        "Puedes dejar de aparecer en las páginas públicas desde los ajustes de tu perfil, y el administrador puede despublicar el club entero desde los ajustes del club.",
        "No vendemos datos ni los cedemos para publicidad.",
      ],
    },
    {
      heading: "5. Proveedores",
      body: [
        `Trabajamos con proveedores que tratan datos por nuestra cuenta: ${providerList}.`,
        "Cuando un proveedor trata datos fuera del Espacio Económico Europeo, la transferencia se ampara en las cláusulas contractuales tipo de la Comisión Europea.",
      ],
    },
    {
      heading: "6. Conservación",
      body: [
        "Los datos de tu cuenta se conservan mientras la cuenta exista.",
        "Los resultados deportivos se conservan mientras el club los quiera conservar: son el historial del club y no solo el tuyo.",
      ],
    },
    {
      heading: "7. Tus derechos",
      body: [
        `Puedes solicitar acceso, rectificación, supresión, limitación, oposición y portabilidad escribiendo a ${CONTACT_EMAIL}. También puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es).`,
        "Sobre la supresión: un partido es un dato compartido. Borrar a una persona borraría también el historial de sus rivales, que es dato suyo. Por eso ejecutamos la supresión como anonimización: se elimina el nombre, el correo, la foto y el vínculo con la cuenta, y el resultado permanece asociado a un participante sin identificar.",
      ],
    },
    {
      heading: "8. Cookies y almacenamiento local",
      body: [
        "Solo usamos cookies y almacenamiento estrictamente necesarios: la sesión de acceso, el idioma y el tema claro u oscuro.",
        "Medimos las visitas con Cloudflare Web Analytics, que no usa cookies ni almacenamiento en tu navegador y no crea un identificador de usuario: cuenta páginas vistas, no personas. Por eso no verás un banner de consentimiento. Si algún día añadimos analítica basada en cookies, pediremos consentimiento antes.",
      ],
    },
    {
      heading: "9. Menores",
      body: [
        "Para tener cuenta hay que tener 16 años o más. Un menor puede jugar y aparecer en el ranking como jugador invitado, dado de alta por el administrador del club sin cuenta y sin correo electrónico.",
      ],
    },
    {
      heading: "10. Cambios",
      body: [
        "Si esta política cambia de forma relevante, lo avisaremos en la aplicación. La fecha de arriba es la de la última versión.",
      ],
    },
  ],
};

const privacyEn: LegalDoc = {
  title: "Privacy policy",
  updated: UPDATED,
  lede: "What PoolClubs processes, why, who can see it, and how to exercise your rights.",
  sections: [
    {
      heading: "1. Controller",
      body: [
        `${OPERATOR.legalName}, tax ID ${OPERATOR.nif}, address ${OPERATOR.address}. Contact: ${CONTACT_EMAIL}.`,
        "For a club's member data the club is the controller and PoolClubs is a processor: we process that data on the club's instructions, to provide it the service.",
      ],
    },
    {
      heading: "2. What we process",
      body: [
        "Account: your email address and the identifier of the provider you sign in with (Google), plus the date you joined.",
        "Profile: the name you appear under in your club, a photo if you upload one, your category and the clubs you belong to.",
        "Playing activity: matches, results, Elo and daily rankings, challenges, tournaments, logged drills, reactions and comments.",
        "Club: name, crest, colour, address and coordinates if the admin adds them.",
        "Technical: error and server logs needed to keep the service running.",
        "No payment data: there is no paid plan today.",
      ],
    },
    {
      heading: "3. Purposes and legal bases",
      body: [
        "Providing the service (account, ranking, matches, tournaments): performance of a contract.",
        "Keeping the service running and secure, including error logs: legitimate interest.",
        "Publishing a club, its players and its results on the public pages: the club's legitimate interest in being found, with the ability to stop appearing at any time (see 4).",
        "Meeting legal obligations where they apply: legal obligation.",
      ],
    },
    {
      heading: "4. Who can see it",
      body: [
        "Inside the app each club sees only its own data: the database enforces row-level security, so a query from another club returns nothing.",
        "Outside the app, a club may publish its page. If it is published, anyone can see the club name, its ranking, results and tournaments, and the name and photo of players marked public. The invite code is never published.",
        "You can stop appearing on the public pages from your profile settings, and an admin can unpublish the whole club from the club settings.",
        "We do not sell data and we do not share it for advertising.",
      ],
    },
    {
      heading: "5. Providers",
      body: [
        `We use providers that process data on our behalf: ${providerList}.`,
        "Where a provider processes data outside the European Economic Area, the transfer relies on the European Commission's standard contractual clauses.",
      ],
    },
    {
      heading: "6. Retention",
      body: [
        "Account data is kept while the account exists.",
        "Playing results are kept as long as the club wants them: they are the club's history, not only yours.",
      ],
    },
    {
      heading: "7. Your rights",
      body: [
        `Write to ${CONTACT_EMAIL} to request access, rectification, erasure, restriction, objection or portability. You can also complain to the Spanish data protection authority, the AEPD (aepd.es).`,
        "On erasure: a match is shared data. Deleting a person would delete their opponents' history too, and that is those people's data. So erasure is carried out as anonymisation: name, email, photo and the link to the account are removed, and the result stays attached to an unidentified participant.",
      ],
    },
    {
      heading: "8. Cookies and local storage",
      body: [
        "We only use strictly necessary cookies and storage: the sign-in session, the language and the light or dark theme.",
        "We count visits with Cloudflare Web Analytics, which uses no cookies and no browser storage and builds no user identifier: it counts page views, not people. That is why you see no consent banner. If we ever add cookie-based analytics, we will ask for consent first.",
      ],
    },
    {
      heading: "9. Minors",
      body: [
        "You must be 16 or older to hold an account. A younger player can play and appear in the ranking as a guest player, added by the club admin with no account and no email address.",
      ],
    },
    {
      heading: "10. Changes",
      body: [
        "If this policy changes materially we will say so in the app. The date above is the current version.",
      ],
    },
  ],
};

const privacyFr: LegalDoc = {
  title: "Politique de confidentialité",
  updated: UPDATED,
  lede: "Quelles données PoolClubs traite, pourquoi, qui les voit et comment exercer vos droits.",
  sections: [
    {
      heading: "1. Responsable du traitement",
      body: [
        `${OPERATOR.legalName}, NIF ${OPERATOR.nif}, adresse ${OPERATOR.address}. Contact : ${CONTACT_EMAIL}.`,
        "Pour les données des membres d'un club, le club est responsable du traitement et PoolClubs agit comme sous-traitant : nous traitons ces données sur ses instructions, pour lui fournir le service.",
      ],
    },
    {
      heading: "2. Données traitées",
      body: [
        "Compte : adresse e-mail et identifiant du fournisseur de connexion (Google), ainsi que la date d'inscription.",
        "Profil : nom sous lequel vous apparaissez dans votre club, photo si vous en ajoutez une, catégorie et clubs auxquels vous appartenez.",
        "Activité sportive : matchs, résultats, classements Elo et journalier, défis, tournois, exercices enregistrés, réactions et commentaires.",
        "Club : nom, écusson, couleur, adresse et coordonnées si l'administrateur les renseigne.",
        "Techniques : journaux d'erreurs et de serveur nécessaires au fonctionnement du service.",
        "Aucune donnée de paiement : il n'existe aujourd'hui aucune offre payante.",
      ],
    },
    {
      heading: "3. Finalités et bases légales",
      body: [
        "Fournir le service (compte, classement, matchs, tournois) : exécution du contrat.",
        "Maintenir le service en état de marche et sécurisé, journaux d'erreurs inclus : intérêt légitime.",
        "Publier un club, ses joueurs et ses résultats sur les pages publiques : intérêt légitime du club à se faire connaître, avec la possibilité de ne plus apparaître à tout moment (voir 4).",
        "Respecter des obligations légales lorsqu'elles s'appliquent : obligation légale.",
      ],
    },
    {
      heading: "4. Qui y a accès",
      body: [
        "Dans l'application, chaque club ne voit que ses propres données : la base applique une sécurité au niveau des lignes, et une requête venant d'un autre club ne renvoie rien.",
        "Hors de l'application, un club peut publier sa page. Si elle est publiée, tout le monde peut voir le nom du club, son classement, ses résultats, ses tournois, ainsi que le nom et la photo des joueurs marqués comme publics. Le code d'invitation n'est jamais publié.",
        "Vous pouvez cesser d'apparaître sur les pages publiques depuis les réglages de votre profil, et un administrateur peut dépublier le club entier depuis les réglages du club.",
        "Nous ne vendons pas de données et ne les partageons pas à des fins publicitaires.",
      ],
    },
    {
      heading: "5. Prestataires",
      body: [
        `Nous faisons appel à des prestataires qui traitent des données pour notre compte : ${providerList}.`,
        "Lorsqu'un prestataire traite des données hors de l'Espace économique européen, le transfert s'appuie sur les clauses contractuelles types de la Commission européenne.",
      ],
    },
    {
      heading: "6. Conservation",
      body: [
        "Les données de compte sont conservées tant que le compte existe.",
        "Les résultats sportifs sont conservés aussi longtemps que le club le souhaite : ils constituent l'historique du club, pas seulement le vôtre.",
      ],
    },
    {
      heading: "7. Vos droits",
      body: [
        `Écrivez à ${CONTACT_EMAIL} pour demander l'accès, la rectification, l'effacement, la limitation, l'opposition ou la portabilité. Vous pouvez également saisir l'autorité espagnole de protection des données, l'AEPD (aepd.es).`,
        "Sur l'effacement : un match est une donnée partagée. Supprimer une personne supprimerait aussi l'historique de ses adversaires, qui est leur donnée. L'effacement est donc réalisé par anonymisation : nom, e-mail, photo et lien avec le compte sont supprimés, et le résultat reste rattaché à un participant non identifié.",
      ],
    },
    {
      heading: "8. Cookies et stockage local",
      body: [
        "Nous n'utilisons que des cookies et un stockage strictement nécessaires : la session de connexion, la langue et le thème clair ou sombre.",
        "Nous mesurons l'audience avec Cloudflare Web Analytics, qui n'utilise ni cookies ni stockage dans votre navigateur et ne crée aucun identifiant d'utilisateur : il compte des pages vues, pas des personnes. D'où l'absence de bandeau de consentement. Si nous ajoutons un jour une mesure d'audience à base de cookies, nous demanderons votre consentement au préalable.",
      ],
    },
    {
      heading: "9. Mineurs",
      body: [
        "Il faut avoir 16 ans ou plus pour disposer d'un compte. Un joueur plus jeune peut jouer et figurer au classement en tant que joueur invité, créé par l'administrateur du club sans compte ni adresse e-mail.",
      ],
    },
    {
      heading: "10. Modifications",
      body: [
        "Si cette politique change de manière substantielle, nous le signalerons dans l'application. La date ci-dessus est celle de la version en vigueur.",
      ],
    },
  ],
};

const termsEs: LegalDoc = {
  title: "Términos de uso",
  updated: UPDATED,
  lede: "Las reglas del servicio: quién puede usarlo, qué esperar de nosotros y qué esperamos de ti.",
  sections: [
    {
      heading: "1. Qué es este servicio",
      body: [
        "PoolClubs es una aplicación web para clubes de billar: ranking, partidos, retos, torneos, ejercicios y planes de entrenamiento.",
        `Lo presta ${OPERATOR.legalName} (ver el aviso legal). Al crear una cuenta o unirte a un club aceptas estos términos.`,
      ],
    },
    {
      heading: "2. Cuenta y edad",
      body: [
        "Necesitas 16 años o más y una cuenta de Google para acceder. Eres responsable de lo que ocurra desde tu cuenta.",
        "Los menores de 16 pueden jugar y aparecer en el ranking como jugadores invitados, dados de alta por el administrador del club: sin cuenta, sin correo y sin acceso a la aplicación.",
        "Un club es responsable de a quién aprueba. Aprobar una solicitud da acceso a todo lo que el club tiene dentro.",
      ],
    },
    {
      heading: "3. Tu club y sus datos",
      body: [
        "El club es responsable de los datos de sus socios; nosotros los tratamos por su cuenta. Ver la política de privacidad.",
        "El administrador del club decide si la página pública del club está publicada y quién forma parte de la plantilla. Cada jugador decide si aparece en las páginas públicas.",
      ],
    },
    {
      heading: "4. Uso aceptable",
      body: [
        "No suplantes a otra persona, no subas contenido ilícito ni datos de terceros que no puedas compartir, y no intentes acceder a datos de un club al que no perteneces.",
        "Podemos suspender una cuenta o un club que incumpla estos términos, avisando siempre que sea razonablemente posible.",
      ],
    },
    {
      heading: "5. Beta y gratuidad",
      body: [
        "El servicio está en beta abierta. Los jugadores no pagan nunca; para los clubes es gratuito durante la beta.",
        "Más adelante habrá una cuota por club. Lo avisaremos con antelación razonable y ningún club empieza a pagar sin haberlo aceptado: quien no acepte pasa a modo lectura y puede exportar sus datos.",
        "Si en el futuro un club con cuota deja de pagar, sus datos no se borran: el club pasa a modo lectura y su página pública sigue en pie.",
      ],
    },
    {
      heading: "6. Disponibilidad y cambios",
      body: [
        "Hacemos lo razonable por mantener el servicio disponible, pero no garantizamos un nivel de servicio ni la ausencia de errores. Puede haber paradas por mantenimiento.",
        "Podemos añadir, cambiar o retirar funciones. Si un cambio te afecta de forma relevante, lo avisaremos en la aplicación.",
      ],
    },
    {
      heading: "7. Contenido",
      body: [
        "El contenido que subes (nombre, foto, ejercicios, comentarios) sigue siendo tuyo. Nos concedes permiso para almacenarlo y mostrarlo dentro del servicio y, si tú o tu club lo publicáis, en las páginas públicas.",
        "El código, el diseño y la biblioteca compartida de ejercicios son del titular del servicio o de sus autores originales, citados en cada ejercicio.",
      ],
    },
    {
      heading: "8. Baja",
      body: [
        `Puedes dejar de usar el servicio en cualquier momento y solicitar la supresión de tus datos escribiendo a ${CONTACT_EMAIL}. La supresión se ejecuta como anonimización, porque los resultados también son historial de tus rivales: ver la política de privacidad.`,
      ],
    },
    {
      heading: "9. Responsabilidad",
      body: [
        "El servicio se presta tal cual. Salvo dolo o negligencia grave, no respondemos de daños indirectos ni de la pérdida de datos que un club no haya conservado por su cuenta.",
        "Nada de lo anterior limita los derechos que la ley reconoce a los consumidores.",
      ],
    },
    {
      heading: "10. Ley aplicable",
      body: [
        "Se aplica la ley española. Para los consumidores, los tribunales competentes son los de su domicilio.",
      ],
    },
  ],
};

const termsEn: LegalDoc = {
  title: "Terms of use",
  updated: UPDATED,
  lede: "The rules of the service: who can use it, what to expect from us, what we expect from you.",
  sections: [
    {
      heading: "1. What this service is",
      body: [
        "PoolClubs is a web app for pool clubs: ranking, matches, challenges, tournaments, drills and training plans.",
        `It is provided by ${OPERATOR.legalName} (see the legal notice). Creating an account or joining a club means you accept these terms.`,
      ],
    },
    {
      heading: "2. Account and age",
      body: [
        "You need to be 16 or older and to have a Google account to sign in. You are responsible for what happens through your account.",
        "Players under 16 can play and appear in the ranking as guest players, added by the club admin: no account, no email address, no access to the app.",
        "A club is responsible for who it approves. Approving a request grants access to everything inside that club.",
      ],
    },
    {
      heading: "3. Your club and its data",
      body: [
        "The club is the controller for its members' data; we process it on the club's behalf. See the privacy policy.",
        "The club admin decides whether the club's public page is published and who is on the roster. Each player decides whether they appear on the public pages.",
      ],
    },
    {
      heading: "4. Acceptable use",
      body: [
        "Do not impersonate anyone, do not upload unlawful content or other people's data you are not allowed to share, and do not attempt to reach data belonging to a club you are not a member of.",
        "We may suspend an account or a club that breaks these terms, with notice whenever that is reasonably possible.",
      ],
    },
    {
      heading: "5. Beta and pricing",
      body: [
        "The service is in open beta. Players never pay; for clubs it is free during the beta.",
        "Later there will be a fee per club. We will give reasonable advance notice and no club starts paying without agreeing to it: a club that does not agree becomes read-only and can export its data.",
        "If a paying club later stops paying, its data is not deleted: the club becomes read-only and its public page stays up.",
      ],
    },
    {
      heading: "6. Availability and changes",
      body: [
        "We make reasonable efforts to keep the service available, but we do not guarantee a service level or freedom from bugs. There may be maintenance downtime.",
        "We may add, change or withdraw features. If a change affects you materially, we will say so in the app.",
      ],
    },
    {
      heading: "7. Content",
      body: [
        "Content you upload (name, photo, drills, comments) stays yours. You grant us permission to store and display it inside the service and, if you or your club publish it, on the public pages.",
        "The code, the design and the shared drill library belong to the operator or to the original authors, credited on each drill.",
      ],
    },
    {
      heading: "8. Leaving",
      body: [
        `You can stop using the service at any time and ask for your data to be erased by writing to ${CONTACT_EMAIL}. Erasure is carried out as anonymisation, because results are your opponents' history too: see the privacy policy.`,
      ],
    },
    {
      heading: "9. Liability",
      body: [
        "The service is provided as is. Except for wilful misconduct or gross negligence, we are not liable for indirect damages or for the loss of data a club has not kept a copy of.",
        "None of the above limits the rights consumers have by law.",
      ],
    },
    {
      heading: "10. Governing law",
      body: [
        "Spanish law applies. For consumers, the competent courts are those of their place of residence.",
      ],
    },
  ],
};

const termsFr: LegalDoc = {
  title: "Conditions d'utilisation",
  updated: UPDATED,
  lede: "Les règles du service : qui peut l'utiliser, ce que vous pouvez attendre de nous et ce que nous attendons de vous.",
  sections: [
    {
      heading: "1. Objet du service",
      body: [
        "PoolClubs est une application web pour clubs de billard : classement, matchs, défis, tournois, exercices et plans d'entraînement.",
        `Le service est fourni par ${OPERATOR.legalName} (voir les mentions légales). Créer un compte ou rejoindre un club vaut acceptation des présentes conditions.`,
      ],
    },
    {
      heading: "2. Compte et âge",
      body: [
        "Il faut avoir 16 ans ou plus et un compte Google pour se connecter. Vous êtes responsable de ce qui se passe depuis votre compte.",
        "Les joueurs de moins de 16 ans peuvent jouer et figurer au classement en tant que joueurs invités, créés par l'administrateur du club : sans compte, sans e-mail et sans accès à l'application.",
        "Un club est responsable des personnes qu'il approuve. Approuver une demande donne accès à tout ce que contient ce club.",
      ],
    },
    {
      heading: "3. Votre club et ses données",
      body: [
        "Le club est responsable des données de ses membres ; nous les traitons pour son compte. Voir la politique de confidentialité.",
        "L'administrateur du club décide si la page publique du club est publiée et qui figure dans l'effectif. Chaque joueur décide s'il apparaît sur les pages publiques.",
      ],
    },
    {
      heading: "4. Usage acceptable",
      body: [
        "N'usurpez pas l'identité d'autrui, ne publiez pas de contenu illicite ni de données de tiers que vous n'avez pas le droit de partager, et n'essayez pas d'accéder aux données d'un club dont vous n'êtes pas membre.",
        "Nous pouvons suspendre un compte ou un club qui ne respecte pas ces conditions, avec préavis chaque fois que cela est raisonnablement possible.",
      ],
    },
    {
      heading: "5. Bêta et gratuité",
      body: [
        "Le service est en bêta ouverte. Les joueurs ne paient jamais ; pour les clubs, c'est gratuit pendant la bêta.",
        "Plus tard, il y aura un tarif par club. Nous préviendrons dans un délai raisonnable et aucun club ne commence à payer sans l'avoir accepté : un club qui refuse passe en lecture seule et peut exporter ses données.",
        "Si un club payant cesse un jour de payer, ses données ne sont pas supprimées : le club passe en lecture seule et sa page publique reste en ligne.",
      ],
    },
    {
      heading: "6. Disponibilité et évolutions",
      body: [
        "Nous faisons des efforts raisonnables pour maintenir le service disponible, sans garantir un niveau de service ni l'absence de bugs. Des interruptions de maintenance sont possibles.",
        "Nous pouvons ajouter, modifier ou retirer des fonctionnalités. Si un changement vous affecte de manière substantielle, nous le signalerons dans l'application.",
      ],
    },
    {
      heading: "7. Contenus",
      body: [
        "Les contenus que vous publiez (nom, photo, exercices, commentaires) restent les vôtres. Vous nous autorisez à les stocker et à les afficher dans le service et, si vous ou votre club les publiez, sur les pages publiques.",
        "Le code, le design et la bibliothèque d'exercices partagée appartiennent à l'exploitant du service ou à leurs auteurs d'origine, cités sur chaque exercice.",
      ],
    },
    {
      heading: "8. Résiliation",
      body: [
        `Vous pouvez cesser d'utiliser le service à tout moment et demander l'effacement de vos données en écrivant à ${CONTACT_EMAIL}. L'effacement est réalisé par anonymisation, car les résultats constituent aussi l'historique de vos adversaires : voir la politique de confidentialité.`,
      ],
    },
    {
      heading: "9. Responsabilité",
      body: [
        "Le service est fourni tel quel. Sauf faute intentionnelle ou négligence grave, nous ne répondons pas des dommages indirects ni de la perte de données dont un club n'a pas conservé de copie.",
        "Ce qui précède ne limite pas les droits reconnus aux consommateurs par la loi.",
      ],
    },
    {
      heading: "10. Droit applicable",
      body: [
        "Le droit espagnol s'applique. Pour les consommateurs, les tribunaux compétents sont ceux de leur lieu de résidence.",
      ],
    },
  ],
};

/** LSSI-CE art. 10: identity, contact and, where it exists, registry data.
 *  Spanish is the operative version — it is the obligation of a service offered
 *  from Spain — and the other two are translations of it. */
const avisoEs: LegalDoc = {
  title: "Aviso legal",
  updated: UPDATED,
  lede: "Información del titular del servicio, conforme al artículo 10 de la LSSI-CE.",
  sections: [
    {
      heading: "1. Titular",
      body: [
        `Titular: ${OPERATOR.legalName}`,
        `NIF: ${OPERATOR.nif}`,
        `Domicilio: ${OPERATOR.address}`,
        `Correo electrónico: ${CONTACT_EMAIL}`,
        ...(OPERATOR.registry
          ? [`Datos registrales: ${OPERATOR.registry}`]
          : []),
      ],
    },
    {
      heading: "2. Objeto",
      body: [
        "Este aviso regula el acceso y el uso del sitio y de la aplicación PoolClubs. Navegar por el sitio implica aceptarlo.",
      ],
    },
    {
      heading: "3. Propiedad intelectual",
      body: [
        "El código, el diseño, los textos y las marcas del sitio pertenecen a su titular, salvo el contenido aportado por los usuarios y los ejercicios de la biblioteca compartida, cuya autoría se cita en cada uno.",
        "No se permite la reproducción o la explotación comercial del sitio sin autorización.",
      ],
    },
    {
      heading: "4. Enlaces",
      body: [
        "El sitio puede enlazar a páginas de terceros (mapas, sitios de clubes). No respondemos de su contenido.",
      ],
    },
    {
      heading: "5. Responsabilidad",
      body: [
        "El titular no garantiza la disponibilidad continua del servicio ni responde de los daños derivados de un uso contrario a los términos de uso.",
      ],
    },
    {
      heading: "6. Protección de datos",
      body: [
        "El tratamiento de datos personales se describe en la política de privacidad.",
      ],
    },
    {
      heading: "7. Legislación aplicable",
      body: [
        "Se aplica la legislación española. Para los consumidores, los tribunales competentes son los de su domicilio.",
      ],
    },
  ],
};

const avisoEn: LegalDoc = {
  title: "Legal notice",
  updated: UPDATED,
  lede: "Operator information, as required by article 10 of Spain's LSSI-CE.",
  sections: [
    {
      heading: "1. Operator",
      body: [
        `Operator: ${OPERATOR.legalName}`,
        `Tax ID: ${OPERATOR.nif}`,
        `Address: ${OPERATOR.address}`,
        `Email: ${CONTACT_EMAIL}`,
        ...(OPERATOR.registry
          ? [`Registry details: ${OPERATOR.registry}`]
          : []),
      ],
    },
    {
      heading: "2. Scope",
      body: [
        "This notice governs access to and use of the PoolClubs site and app. Browsing the site means accepting it.",
      ],
    },
    {
      heading: "3. Intellectual property",
      body: [
        "The code, design, texts and marks of the site belong to its operator, except for user-contributed content and the drills in the shared library, each of which credits its author.",
        "Reproduction or commercial exploitation of the site without permission is not allowed.",
      ],
    },
    {
      heading: "4. Links",
      body: [
        "The site may link to third-party pages (maps, club websites). We are not responsible for their content.",
      ],
    },
    {
      heading: "5. Liability",
      body: [
        "The operator does not guarantee continuous availability of the service and is not liable for damage arising from use contrary to the terms of use.",
      ],
    },
    {
      heading: "6. Data protection",
      body: ["Personal data processing is described in the privacy policy."],
    },
    {
      heading: "7. Governing law",
      body: [
        "Spanish law applies. For consumers, the competent courts are those of their place of residence.",
      ],
    },
  ],
};

const avisoFr: LegalDoc = {
  title: "Mentions légales",
  updated: UPDATED,
  lede: "Informations sur l'exploitant du service, conformément à l'article 10 de la LSSI-CE espagnole.",
  sections: [
    {
      heading: "1. Exploitant",
      body: [
        `Exploitant : ${OPERATOR.legalName}`,
        `NIF : ${OPERATOR.nif}`,
        `Adresse : ${OPERATOR.address}`,
        `E-mail : ${CONTACT_EMAIL}`,
        ...(OPERATOR.registry
          ? [`Informations d'immatriculation : ${OPERATOR.registry}`]
          : []),
      ],
    },
    {
      heading: "2. Objet",
      body: [
        "Les présentes mentions régissent l'accès au site et à l'application PoolClubs ainsi que leur utilisation. Naviguer sur le site vaut acceptation.",
      ],
    },
    {
      heading: "3. Propriété intellectuelle",
      body: [
        "Le code, le design, les textes et les marques du site appartiennent à son exploitant, à l'exception des contenus fournis par les utilisateurs et des exercices de la bibliothèque partagée, dont l'auteur est cité.",
        "Toute reproduction ou exploitation commerciale du site sans autorisation est interdite.",
      ],
    },
    {
      heading: "4. Liens",
      body: [
        "Le site peut renvoyer vers des pages de tiers (cartes, sites de clubs). Nous ne répondons pas de leur contenu.",
      ],
    },
    {
      heading: "5. Responsabilité",
      body: [
        "L'exploitant ne garantit pas la disponibilité continue du service et ne répond pas des dommages résultant d'un usage contraire aux conditions d'utilisation.",
      ],
    },
    {
      heading: "6. Protection des données",
      body: [
        "Le traitement des données personnelles est décrit dans la politique de confidentialité.",
      ],
    },
    {
      heading: "7. Droit applicable",
      body: [
        "Le droit espagnol s'applique. Pour les consommateurs, les tribunaux compétents sont ceux de leur lieu de résidence.",
      ],
    },
  ],
};

export const LEGAL: Record<LegalDocId, Record<Lang, LegalDoc>> = {
  privacy: { es: privacyEs, en: privacyEn, fr: privacyFr },
  terms: { es: termsEs, en: termsEn, fr: termsFr },
  "aviso-legal": { es: avisoEs, en: avisoEn, fr: avisoFr },
};
