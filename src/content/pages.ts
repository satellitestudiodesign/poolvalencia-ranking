import type { Lang } from "@/i18n";
import { CONTACT_EMAIL } from "@/content/legal";

/**
 * The prose pages: pricing, about, contact.
 *
 * Same reasoning as src/content/legal.ts — these are documents, not UI strings,
 * so they live as one object per language instead of ninety keys spread across
 * three dictionaries. Anything a component labels (a button, a table header)
 * still belongs in src/i18n.
 *
 * Every claim here has to stay true of the product as shipped. The pricing page
 * is the one that gets quoted back, so it says only what is certain: free for
 * clubs through the beta, one per-club fee afterwards, and notice before it
 * starts. No promise about what a beta club pays later, because there isn't one.
 */
export type ContentSection = {
  heading?: string;
  body?: string[];
  bullets?: string[];
};

export type ContentDoc = {
  title: string;
  lede: string;
  /** One statement set apart above the sections. */
  callout?: string;
  /** ISO date. Only the legal documents show one. */
  updated?: string;
  sections: ContentSection[];
  links?: { label: string; href: string }[];
};

const PRICING_ES: ContentDoc = {
  title: "Precio",
  lede: "Los jugadores no pagan nunca. Los clubes, gratis durante la beta.",
  callout:
    "PoolClubs es gratis para los clubes mientras dure la beta. Después habrá una cuota por club y mes.",
  sections: [
    {
      heading: "Hoy",
      body: [
        "Beta abierta y gratuita. Sin plan de pago, sin prueba que caduque y sin tarjeta.",
        "Un club se crea en un minuto, invita a sus socios con un enlace o un cartel con código QR, y empieza a registrar partidos la misma noche.",
      ],
    },
    {
      heading: "Más adelante",
      body: [
        "Cuando el producto esté cerrado habrá una cuota por club y mes. Una sola: sin asientos, sin tramos, sin extras por socio.",
        "Lo avisaremos con antelación, dentro de la aplicación y por correo. Ningún club empieza a pagar sin decir que sí, y un club que prefiera no seguir se lleva sus datos.",
        "La referencia es la que el club ya conoce: menos de lo que factura una mesa en una noche.",
        "Los jugadores seguirán sin pagar. Es un servicio que el club da a sus socios, no una suscripción que cada socio contrata.",
      ],
    },
    {
      heading: "Qué incluye",
      bullets: [
        "Ranking Elo del club y ranking diario",
        "Partidos individuales y por parejas, en bola 8, 9 y 10",
        "Retos entre socios",
        "Torneos: eliminatoria simple, doble y liguilla, con cuadro y walkovers",
        "Biblioteca de ejercicios y planes de entrenamiento automáticos",
        "Muro de actividad con reacciones y comentarios",
        "Página pública del club, con mapa, para quien busque dónde jugar",
        "Se instala como app en el móvil, sin tienda de aplicaciones",
        "Español, inglés y francés",
      ],
    },
    {
      heading: "Lo que no vamos a hacer",
      bullets: [
        "Vender los datos del club o de sus socios",
        "Poner publicidad",
        "Quitarle a un club su historial: si un club con cuota deja de pagar, pasa a modo lectura y su página pública sigue en pie",
      ],
    },
  ],
};

const PRICING_EN: ContentDoc = {
  title: "Pricing",
  lede: "Players never pay. Clubs are free for as long as the beta lasts.",
  callout:
    "PoolClubs is free for clubs while the beta lasts. After that there will be one fee, per club, per month.",
  sections: [
    {
      heading: "Today",
      body: [
        "Open beta, free. No paid plan, no trial that expires, no card.",
        "A club takes a minute to set up, invites its members with a link or a printed QR poster, and starts recording matches the same night.",
      ],
    },
    {
      heading: "Later",
      body: [
        "Once the product is finished there will be one fee, per club, per month. One: no seats, no tiers, no per-member extras.",
        "We will say so in advance, in the app and by email. No club starts paying without agreeing to it, and a club that would rather stop takes its data with it.",
        "The benchmark is the one a club already knows: less than one night's table time.",
        "Players will still pay nothing. This is a service the club gives its members, not a subscription each member signs up for.",
      ],
    },
    {
      heading: "What's included",
      bullets: [
        "Club Elo ranking and daily ranking",
        "Singles and doubles matches, in 8-, 9- and 10-ball",
        "Challenges between members",
        "Tournaments: single elimination, double elimination and round robin, with brackets and walkovers",
        "Drill library and auto-generated training plans",
        "Activity feed with reactions and comments",
        "A public club page, on the map, for anyone looking for somewhere to play",
        "Installs as an app on a phone, with no app store",
        "Spanish, English and French",
      ],
    },
    {
      heading: "What we won't do",
      bullets: [
        "Sell the club's data or its members' data",
        "Run ads",
        "Take a club's history away: a paying club that stops paying becomes read-only and its public page stays up",
      ],
    },
  ],
};

const PRICING_FR: ContentDoc = {
  title: "Tarif",
  lede: "Les joueurs ne paient jamais. Les clubs, gratuit pendant la bêta.",
  callout:
    "PoolClubs est gratuit pour les clubs tant que dure la bêta. Ensuite, il y aura un tarif unique, par club et par mois.",
  sections: [
    {
      heading: "Aujourd'hui",
      body: [
        "Bêta ouverte et gratuite. Aucune offre payante, aucun essai qui expire, aucune carte bancaire.",
        "Un club se crée en une minute, invite ses membres avec un lien ou une affiche à code QR, et enregistre ses premiers matchs le soir même.",
      ],
    },
    {
      heading: "Plus tard",
      body: [
        "Quand le produit sera abouti, il y aura un tarif unique, par club et par mois. Un seul : pas de sièges, pas de paliers, pas de suppléments par membre.",
        "Nous le préviendrons à l'avance, dans l'application et par e-mail. Aucun club ne commence à payer sans l'avoir accepté, et un club qui préfère s'arrêter repart avec ses données.",
        "La référence est celle que le club connaît déjà : moins qu'une soirée de table.",
        "Les joueurs ne paieront toujours rien. C'est un service que le club offre à ses membres, pas un abonnement que chacun souscrit.",
      ],
    },
    {
      heading: "Ce qui est inclus",
      bullets: [
        "Classement Elo du club et classement journalier",
        "Matchs en simple et en double, en 8, 9 et 10 billes",
        "Défis entre membres",
        "Tournois : élimination simple, double élimination et poule, avec tableau et forfaits",
        "Bibliothèque d'exercices et plans d'entraînement générés automatiquement",
        "Fil d'activité avec réactions et commentaires",
        "Une page publique du club, sur la carte, pour qui cherche où jouer",
        "S'installe comme une app sur le téléphone, sans passer par un store",
        "Espagnol, anglais et français",
      ],
    },
    {
      heading: "Ce que nous ne ferons pas",
      bullets: [
        "Vendre les données du club ou de ses membres",
        "Afficher de la publicité",
        "Priver un club de son historique : un club payant qui cesse de payer passe en lecture seule et sa page publique reste en ligne",
      ],
    },
  ],
};

const ABOUT_ES: ContentDoc = {
  title: "Qué es PoolClubs",
  lede: "Una herramienta para clubes de billar, hecha por gente que ha organizado torneos y ha llevado el ranking en una hoja de cálculo.",
  sections: [
    {
      heading: "Por qué existe",
      body: [
        "En casi todos los clubes el ranking vive en un Excel que actualiza una persona, y los resultados de la liguilla del año pasado están en una libreta detrás de la barra. Funciona hasta que esa persona no puede una semana.",
        "PoolClubs mueve eso al móvil de los socios: cada uno registra su partido, la tabla se recalcula sola y el club deja de depender de una sola persona con un fichero.",
      ],
    },
    {
      heading: "Para quién es",
      body: [
        "Para el club que quiere un ranking que se mantenga solo, para el socio que quiere ver si está subiendo, y para el que entrena y quiere medirlo con ejercicios en vez de a ojo.",
        "Sirve igual a un club con mesa propia y liga interna que a un grupo que se junta los jueves.",
      ],
    },
    {
      heading: "Cómo está hecho",
      body: [
        "Es una aplicación web: se abre en el navegador y se instala en la pantalla de inicio como una app, sin pasar por ninguna tienda.",
        "Cada club ve solo sus datos, y eso lo garantiza la base de datos, no la aplicación.",
        "Está en español, inglés y francés.",
      ],
    },
    {
      heading: "En qué punto está",
      body: [
        "En beta abierta con clubes reales, y lo que falta se construye en el orden en que los clubes lo piden.",
        "Si echas algo en falta, escríbenos: durante la beta lo que piden los clubes es lo que se construye.",
      ],
    },
  ],
};

const ABOUT_EN: ContentDoc = {
  title: "About PoolClubs",
  lede: "A tool for pool clubs, built by people who have run tournaments and kept a ranking in a spreadsheet.",
  sections: [
    {
      heading: "Why it exists",
      body: [
        "In most clubs the ranking lives in a spreadsheet one person updates, and last year's round robin is in a notebook behind the bar. That works until the week that person can't make it.",
        "PoolClubs moves it onto the members' phones: everyone records their own match, the table recalculates itself, and the club stops depending on one person with one file.",
      ],
    },
    {
      heading: "Who it's for",
      body: [
        "For the club that wants a ranking that maintains itself, for the member who wants to see whether they are climbing, and for the player who practises and would rather measure it with drills than by feel.",
        "It fits a club with its own tables and an internal league as well as a group that meets on Thursdays.",
      ],
    },
    {
      heading: "How it's built",
      body: [
        "It is a web app: it opens in the browser and installs to the home screen like an app, with no app store involved.",
        "Each club sees only its own data, and that is enforced by the database rather than by the app.",
        "It is available in Spanish, English and French.",
      ],
    },
    {
      heading: "Where it stands",
      body: [
        "In open beta with real clubs, and what is missing gets built in the order clubs ask for it.",
        "If something you need isn't there, write to us: during the beta, what clubs ask for is what gets built.",
      ],
    },
  ],
};

const ABOUT_FR: ContentDoc = {
  title: "À propos de PoolClubs",
  lede: "Un outil pour les clubs de billard, conçu par des gens qui ont organisé des tournois et tenu un classement dans un tableur.",
  sections: [
    {
      heading: "Pourquoi ce service existe",
      body: [
        "Dans la plupart des clubs, le classement vit dans un tableur mis à jour par une seule personne, et la poule de l'an dernier est dans un carnet derrière le bar. Cela fonctionne jusqu'à la semaine où cette personne n'est pas là.",
        "PoolClubs déplace tout cela sur le téléphone des membres : chacun enregistre son match, le tableau se recalcule seul, et le club ne dépend plus d'une personne et d'un fichier.",
      ],
    },
    {
      heading: "À qui il s'adresse",
      body: [
        "Au club qui veut un classement qui se tient à jour tout seul, au membre qui veut savoir s'il progresse, et au joueur qui s'entraîne et préfère le mesurer avec des exercices plutôt qu'au ressenti.",
        "Il convient autant à un club avec ses tables et sa ligue interne qu'à un groupe qui se retrouve le jeudi.",
      ],
    },
    {
      heading: "Comment il est fait",
      body: [
        "C'est une application web : elle s'ouvre dans le navigateur et s'installe sur l'écran d'accueil comme une app, sans passer par un store.",
        "Chaque club ne voit que ses propres données, et c'est la base de données qui le garantit, pas l'application.",
        "Elle est disponible en espagnol, en anglais et en français.",
      ],
    },
    {
      heading: "Où nous en sommes",
      body: [
        "En bêta ouverte avec de vrais clubs, et ce qui manque est construit dans l'ordre où les clubs le demandent.",
        "S'il vous manque quelque chose, écrivez-nous : pendant la bêta, ce que demandent les clubs est ce qui se construit.",
      ],
    },
  ],
};

const CONTACT_ES: ContentDoc = {
  title: "Contacto",
  lede: "Una dirección de correo, leída por quien construye esto.",
  sections: [
    {
      heading: "Escríbenos",
      body: [
        `${CONTACT_EMAIL}`,
        "Respondemos en unos días. No hay centro de soporte ni número de ticket: el correo llega a quien puede arreglarlo.",
      ],
    },
    {
      heading: "Si eres un club",
      body: [
        "Cuéntanos cuántos socios sois y cómo lleváis hoy el ranking. Podemos montar el club contigo y dejarlo listo antes de que lo enseñes a tus socios.",
        "Durante la beta el servicio es gratis para el club. Más adelante habrá una cuota por club y mes, avisada con antelación.",
      ],
    },
    {
      heading: "Si has encontrado un fallo",
      body: [
        "Dinos qué hacías, qué esperabas y qué pasó. Si puedes, añade el enlace de la página y una captura.",
      ],
    },
    {
      heading: "Protección de datos",
      body: [
        "Para ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación o portabilidad, escribe a la misma dirección indicando qué quieres. Los detalles están en la política de privacidad.",
      ],
    },
  ],
  links: [
    { label: `Escribir a ${CONTACT_EMAIL}`, href: `mailto:${CONTACT_EMAIL}` },
  ],
};

const CONTACT_EN: ContentDoc = {
  title: "Contact",
  lede: "One email address, read by the person building this.",
  sections: [
    {
      heading: "Write to us",
      body: [
        `${CONTACT_EMAIL}`,
        "We answer within a few days. There is no support centre and no ticket number: the email reaches whoever can fix it.",
      ],
    },
    {
      heading: "If you run a club",
      body: [
        "Tell us how many members you have and how the ranking is kept today. We can set the club up with you and have it ready before you show it to your members.",
        "During the beta the service is free for the club. Later there will be one fee, per club, per month, announced in advance.",
      ],
    },
    {
      heading: "If you found a bug",
      body: [
        "Tell us what you were doing, what you expected and what happened. If you can, add the page link and a screenshot.",
      ],
    },
    {
      heading: "Data protection",
      body: [
        "To exercise your rights of access, rectification, erasure, objection, restriction or portability, write to the same address saying what you want. The details are in the privacy policy.",
      ],
    },
  ],
  links: [{ label: `Email ${CONTACT_EMAIL}`, href: `mailto:${CONTACT_EMAIL}` }],
};

const CONTACT_FR: ContentDoc = {
  title: "Contact",
  lede: "Une adresse e-mail, lue par la personne qui construit ce service.",
  sections: [
    {
      heading: "Écrivez-nous",
      body: [
        `${CONTACT_EMAIL}`,
        "Nous répondons en quelques jours. Il n'y a ni centre de support ni numéro de ticket : l'e-mail arrive à qui peut corriger le problème.",
      ],
    },
    {
      heading: "Si vous gérez un club",
      body: [
        "Dites-nous combien vous êtes de membres et comment le classement est tenu aujourd'hui. Nous pouvons configurer le club avec vous et le rendre prêt avant que vous ne le montriez à vos membres.",
        "Pendant la bêta le service est gratuit pour le club. Plus tard, il y aura un tarif unique par club et par mois, annoncé à l'avance.",
      ],
    },
    {
      heading: "Si vous avez trouvé un bug",
      body: [
        "Dites-nous ce que vous faisiez, ce que vous attendiez et ce qui s'est passé. Si possible, ajoutez le lien de la page et une capture d'écran.",
      ],
    },
    {
      heading: "Protection des données",
      body: [
        "Pour exercer vos droits d'accès, de rectification, d'effacement, d'opposition, de limitation ou de portabilité, écrivez à la même adresse en précisant votre demande. Les détails figurent dans la politique de confidentialité.",
      ],
    },
  ],
  links: [
    { label: `Écrire à ${CONTACT_EMAIL}`, href: `mailto:${CONTACT_EMAIL}` },
  ],
};

export const PRICING: Record<Lang, ContentDoc> = {
  es: PRICING_ES,
  en: PRICING_EN,
  fr: PRICING_FR,
};

export const ABOUT: Record<Lang, ContentDoc> = {
  es: ABOUT_ES,
  en: ABOUT_EN,
  fr: ABOUT_FR,
};

export const CONTACT: Record<Lang, ContentDoc> = {
  es: CONTACT_ES,
  en: CONTACT_EN,
  fr: CONTACT_FR,
};
