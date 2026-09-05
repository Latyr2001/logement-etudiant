import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import DemandeForm from "./DemandeForm";
import logo from "./logo.png";
import equipe from "./equipe.jpg";
import emailjs from "@emailjs/browser";

const MOIS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

// Ordre d'affichage pour le suivi des loyers : l'année scolaire
// commence en octobre, donc on décale l'affichage (le calcul interne
// des loyers, lui, continue d'utiliser MOIS_FR tel quel car il dépend
// de getMonth() de JavaScript, qui compte Janvier = 0).
const ORDRE_ANNEE_SCOLAIRE = [...MOIS_FR.slice(9), ...MOIS_FR.slice(0, 9)];

// Lieux possibles pour les chambres gérées hors formulaire (campus social, ESP, Claudel)
const LIEUX_CHAMBRE = ["Campus social", "ESP", "Claudel"];

// ⚠️ Mot de passe fixe pour l'espace "Campus social" — à changer ici si besoin.
// Attention : visible dans le code source, ne pas réutiliser un mot de passe sensible.
const MOT_DE_PASSE_CAMPUS = "AEERN-campus2026";

function App() {
  const [page, setPage] = useState("accueil");
  const [demandes, setDemandes] = useState([]);
  const [loyers, setLoyers] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [authentifie, setAuthentifie] = useState(false);
  const [emailSaisi, setEmailSaisi] = useState("");
  const [motDePasseSaisi, setMotDePasseSaisi] = useState("");
  const [erreurMdp, setErreurMdp] = useState("");

  const [authentifieCampus, setAuthentifieCampus] = useState(false);
  const [motDePasseCampusSaisi, setMotDePasseCampusSaisi] = useState("");
  const [erreurCampus, setErreurCampus] = useState("");
  const [campusFormData, setCampusFormData] = useState({
    nom: "",
    prenom: "",
    telephone: "",
    filiere: "",
    niveau: "",
    lieuChambre: "Campus social",
    numeroChambre: "",
  });
  const [campusCertificatFile, setCampusCertificatFile] = useState(null);

  const [recuEtudiant, setRecuEtudiant] = useState(null);
  const [recuLoyersPayes, setRecuLoyersPayes] = useState([]);
  const [recuErreur, setRecuErreur] = useState("");

  const [modeInscription, setModeInscription] = useState(false);
  const [compteEmail, setCompteEmail] = useState("");
  const [compteMotDePasse, setCompteMotDePasse] = useState("");
  const [erreurCompte, setErreurCompte] = useState("");
  const [messageCompte, setMessageCompte] = useState("");
  const [afficherMotDePasseCompte, setAfficherMotDePasseCompte] = useState(false);

  const [modeMotDePasseOublie, setModeMotDePasseOublie] = useState(false);
  const [emailRecuperation, setEmailRecuperation] = useState("");
  const [erreurRecuperation, setErreurRecuperation] = useState("");
  const [messageRecuperation, setMessageRecuperation] = useState("");

  const [modeRecuperation, setModeRecuperation] = useState(false);
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState("");
  const [afficherNouveauMotDePasse, setAfficherNouveauMotDePasse] = useState(false);
  const [erreurNouveauMotDePasse, setErreurNouveauMotDePasse] = useState("");
  const [messageNouveauMotDePasse, setMessageNouveauMotDePasse] = useState("");

  const [afficherMotDePasseAdmin, setAfficherMotDePasseAdmin] = useState(false);
  const [afficherMotDePasseCampus, setAfficherMotDePasseCampus] = useState(false);

  const EMAILJS_SERVICE_ID = "service_1pbl2tm";
  const EMAILJS_TEMPLATE_ID = "template_tjcrgph";
  const EMAILJS_PUBLIC_KEY = "1it575--ftfEqFdFS";

  const chargerDemandes = async () => {
    setChargement(true);
    const { data, error } = await supabase
      .from("demandes")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) setDemandes(data);
    setChargement(false);
  };

  const chargerLoyers = async () => {
    const { data, error } = await supabase
      .from("loyers")
      .select("*")
      .order("annee", { ascending: true });

    if (!error) setLoyers(data);
  };

  const [session, setSession] = useState(null);
  const [estAdmin, setEstAdmin] = useState(false);

  const verifierSiAdmin = async (sessionActuelle) => {
    if (!sessionActuelle) {
      setEstAdmin(false);
      setAuthentifie(false);
      return;
    }
    const { data } = await supabase
      .from("admins")
      .select("email")
      .eq("email", sessionActuelle.user.email)
      .maybeSingle();

    const estAdminMaintenant = !!data;
    setEstAdmin(estAdminMaintenant);
    setAuthentifie(estAdminMaintenant);
  };

  useEffect(() => {
    chargerDemandes();
    chargerLoyers();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      verifierSiAdmin(session);
    });

    const { data: ecouteur } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      verifierSiAdmin(session);
      if (_event === "PASSWORD_RECOVERY") {
        setModeRecuperation(true);
      }
    });

    return () => ecouteur.subscription.unsubscribe();
  }, []);

  const ajouterDemande = (nouvelleDemande) => {
    setDemandes((prev) => [nouvelleDemande, ...prev]);
  };

  const envoyerEmail = (demande, statut) => {
    const params = {
      prenom: demande.prenom,
      nom: demande.nom,
      quartier: demande.quartier === "Autre" ? demande.autreQuartier : demande.quartier,
      statut: statut,
      email: demande.email,
    };

    emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params, EMAILJS_PUBLIC_KEY)
      .catch((err) => console.error("Erreur envoi email:", err));
  };

  const creerLoyersPourDemande = async (demandeId) => {
    const maintenant = new Date();
    const anneeActuelle = maintenant.getFullYear();
    const moisActuel = maintenant.getMonth();

    const nouveauxLoyers = [];
    for (let i = 0; i < 12; i++) {
      const indexMois = (moisActuel + i) % 12;
      const anneeCalculee = anneeActuelle + Math.floor((moisActuel + i) / 12);
      nouveauxLoyers.push({
        demande_id: demandeId,
        mois: MOIS_FR[indexMois],
        annee: anneeCalculee,
        paye: false,
      });
    }

    const { error } = await supabase.from("loyers").insert(nouveauxLoyers);
    if (error) {
      console.error("Erreur création loyers:", error);
    } else {
      chargerLoyers();
    }
  };

  const changerStatut = async (id, nouveauStatut) => {
    const { error } = await supabase
      .from("demandes")
      .update({ statut: nouveauStatut })
      .eq("id", id);

    if (error) {
      console.error(error);
      return;
    }

    setDemandes((prev) =>
      prev.map((d) => (d.id === id ? { ...d, statut: nouveauStatut } : d))
    );

    const demandeConcernee = demandes.find((d) => d.id === id);
    if (demandeConcernee) {
      if (nouveauStatut === "validée" || nouveauStatut === "non validée") {
        envoyerEmail(demandeConcernee, nouveauStatut);
      }
      if (nouveauStatut === "validée" && !demandeConcernee.lieuChambre) {
        const dejaCree = loyers.some((l) => l.demande_id === id);
        if (!dejaCree) {
          creerLoyersPourDemande(id);
        }
      }
    }
  };

  const supprimerDemande = async (id) => {
    const confirmation = window.confirm("Supprimer définitivement cette demande ?");
    if (!confirmation) return;

    const { error } = await supabase.from("demandes").delete().eq("id", id);
    if (error) {
      alert("Erreur lors de la suppression.");
      return;
    }
    setDemandes((prev) => prev.filter((d) => d.id !== id));
  };

  const couleurStatut = (statut) => {
    if (statut === "validée") return "#2e7d32";
    if (statut === "non validée") return "#c62828";
    return "#f9a825";
  };

  const verifierMotDePasse = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({
      email: emailSaisi,
      password: motDePasseSaisi,
    });
    if (error) {
      setErreurMdp("Email ou mot de passe incorrect.");
    } else {
      setErreurMdp("");
    }
  };

  const seDeconnecter = async () => {
    await supabase.auth.signOut();
  };

  const inscrireEtudiant = async (e) => {
    e.preventDefault();
    setErreurCompte("");
    setMessageCompte("");
    const { error } = await supabase.auth.signUp({
      email: compteEmail,
      password: compteMotDePasse,
    });
    if (error) {
      setErreurCompte(error.message);
      return;
    }
    setMessageCompte("Compte créé. Si une confirmation par email est requise, vérifie ta boîte mail avant de te connecter.");
  };

  const connecterEtudiant = async (e) => {
    e.preventDefault();
    setErreurCompte("");
    const { error } = await supabase.auth.signInWithPassword({
      email: compteEmail,
      password: compteMotDePasse,
    });
    if (error) {
      setErreurCompte("Email ou mot de passe incorrect.");
    }
  };

  const demanderReinitialisation = async (e) => {
    e.preventDefault();
    setErreurRecuperation("");
    setMessageRecuperation("");
    const { error } = await supabase.auth.resetPasswordForEmail(emailRecuperation, {
      redirectTo: window.location.origin,
    });
    if (error) {
      setErreurRecuperation("Une erreur est survenue. Vérifie l'adresse email.");
      return;
    }
    setMessageRecuperation("Un email avec un lien de réinitialisation vient de t'être envoyé.");
  };

  const definirNouveauMotDePasse = async (e) => {
    e.preventDefault();
    setErreurNouveauMotDePasse("");
    setMessageNouveauMotDePasse("");
    const { error } = await supabase.auth.updateUser({ password: nouveauMotDePasse });
    if (error) {
      setErreurNouveauMotDePasse("Impossible de mettre à jour le mot de passe. Réessaie.");
      return;
    }
    setMessageNouveauMotDePasse("Mot de passe mis à jour ! Tu peux continuer normalement.");
    setTimeout(() => setModeRecuperation(false), 2000);
  };

  // Récupère automatiquement les mois payés de l'étudiant connecté (plus besoin de ressaisir ses infos).
  const chargerRecusEtudiant = async () => {
    if (!session || estAdmin) return;

    const { data: mesDemandes } = await supabase
      .from("demandes")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("statut", "validée");

    if (!mesDemandes || mesDemandes.length === 0) {
      setRecuEtudiant(null);
      setRecuLoyersPayes([]);
      return;
    }

    const etudiant = mesDemandes[0];
    setRecuEtudiant(etudiant);

    const { data: mesLoyers } = await supabase
      .from("loyers")
      .select("*")
      .eq("demande_id", etudiant.id)
      .eq("paye", true);

    setRecuLoyersPayes(mesLoyers || []);
  };

  useEffect(() => {
    if (session && !estAdmin) {
      chargerRecusEtudiant();
    }
  }, [session, estAdmin]);

  // Ouvre un reçu de paiement imprimable (l'étudiant peut l'enregistrer en PDF via Ctrl+P).
  const telechargerRecu = (loyer) => {
    const fenetre = window.open("", "_blank");
    if (!fenetre) return;

    const dateGeneration = new Date().toLocaleDateString("fr-FR");

    fenetre.document.write(`
      <html>
        <head>
          <title>Reçu de paiement</title>
          <meta charset="utf-8" />
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1a1a1a; }
            .carte { max-width: 480px; margin: 0 auto; border: 2px solid #0d3b66; border-radius: 14px; padding: 30px; }
            h1 { color: #0d3b66; font-size: 20px; margin-bottom: 4px; }
            .sous-titre { color: #777; font-size: 13px; margin-bottom: 24px; }
            table { width: 100%; border-collapse: collapse; }
            td { padding: 8px 0; font-size: 14px; border-bottom: 1px solid #eee; }
            td:first-child { color: #555; font-weight: 600; width: 45%; }
            .statut { margin-top: 24px; text-align: center; background: #dcf5e3; color: #1e7d3a; font-weight: bold; padding: 10px; border-radius: 8px; }
            .pied { margin-top: 24px; font-size: 11px; color: #999; text-align: center; }
          </style>
        </head>
        <body onload="window.print()">
          <div class="carte">
            <h1>Reçu de paiement — Keur Bou Mag Bii</h1>
            <p class="sous-titre">AEERN — Amicale des Étudiants et Élèves Ressortissants de Ndiaganiao</p>
            <table>
              <tr><td>Nom</td><td>${recuEtudiant.nom}</td></tr>
              <tr><td>Prénom</td><td>${recuEtudiant.prenom}</td></tr>
              <tr><td>Numéro de carte étudiant</td><td>${recuEtudiant.numeroCarteEtudiant}</td></tr>
              <tr><td>Mois concerné</td><td>${loyer.mois} ${loyer.annee}</td></tr>
              <tr><td>Date d'émission du reçu</td><td>${dateGeneration}</td></tr>
            </table>
            <div class="statut">✔ Loyer payé</div>
            <p class="pied">Document généré automatiquement — Keur Bou Mag Bii</p>
          </div>
        </body>
      </html>
    `);
    fenetre.document.close();
  };

  const verifierMotDePasseCampus = (e) => {
    e.preventDefault();
    if (motDePasseCampusSaisi === MOT_DE_PASSE_CAMPUS) {
      setAuthentifieCampus(true);
      setErreurCampus("");
    } else {
      setErreurCampus("Mot de passe incorrect.");
    }
  };

  const handleCampusChange = (e) => {
    const { name, value } = e.target;
    setCampusFormData((prev) => ({ ...prev, [name]: value }));
  };

  const ajouterEtudiantCampus = async (e) => {
    e.preventDefault();

    let certificatUrl = "";

    if (campusCertificatFile) {
      const nomFichier = `${Date.now()}_${campusCertificatFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("certificats")
        .upload(nomFichier, campusCertificatFile);

      if (uploadError) {
        console.error("Erreur upload certificat:", uploadError);
        alert("Erreur lors de l'envoi du certificat.");
        return;
      }

      const { data: urlData } = supabase.storage
        .from("certificats")
        .getPublicUrl(nomFichier);

      certificatUrl = urlData.publicUrl;
    }

    const nouvelleEntree = {
      nom: campusFormData.nom,
      prenom: campusFormData.prenom,
      telephone: campusFormData.telephone,
      filiere: campusFormData.filiere,
      niveau: campusFormData.niveau,
      lieuChambre: campusFormData.lieuChambre,
      numeroChambre: campusFormData.numeroChambre,
      certificat: certificatUrl,
      statut: "en attente",
    };

    const { error } = await supabase.from("demandes").insert([nouvelleEntree]);

    if (error) {
      console.error("Erreur ajout étudiant campus:", error);
      alert("Erreur lors de l'ajout de l'étudiant.");
      return;
    }

    ajouterDemande({ ...nouvelleEntree, id: Date.now() });
    setCampusFormData({
      nom: "",
      prenom: "",
      telephone: "",
      filiere: "",
      niveau: "",
      lieuChambre: "Campus social",
      numeroChambre: "",
    });
    setCampusCertificatFile(null);
  };

  const voirCertificat = async (certificat) => {
    let chemin = certificat;
    const marqueur = "/certificats/";
    const position = certificat.indexOf(marqueur);
    if (position !== -1) {
      chemin = certificat.substring(position + marqueur.length);
    }
    const { data, error } = await supabase.storage
      .from("certificats")
      .createSignedUrl(chemin, 60);

    if (error || !data) {
      alert("Impossible d'ouvrir ce certificat.");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const bleuFonce = "#0d3b66";
  const bleuMoyen = "#1e5fa8";
  const bleuNuit = "#0c1f4b";

  const badgeStatut = (statut) => {
    const couleurs = {
      "validée": { bg: "#dcf5e3", text: "#1e7d3a" },
      "non validée": { bg: "#fbdede", text: "#c0392b" },
      "en attente": { bg: "#fdecc8", text: "#b8860b" },
    };
    const c = couleurs[statut] || { bg: "#eee", text: "#555" };
    return (
      <span style={{
        backgroundColor: c.bg,
        color: c.text,
        padding: "4px 12px",
        borderRadius: "20px",
        fontWeight: "700",
        fontSize: "13px",
        whiteSpace: "nowrap",
      }}>
        {statut}
      </span>
    );
  };

  // ⚠️ Remplacez ce lien par votre lien marchand Wave
  // (ex: "https://pay.wave.com/m/M_xxxxxxx/c/sn/")
  const LIEN_WAVE = "https://pay.wave.com/m/M_xxxxxxx/c/sn/";

  const demandesValidees = demandes.filter((d) => d.statut === "validée");
  // Les étudiants logés au campus social/ESP/Claudel ne paient pas leur loyer
  // sur la plateforme : on les sépare du reste pour les exclure du suivi des loyers.
  const demandesValideesAppartement = demandesValidees.filter((d) => !d.lieuChambre);
  const demandesValideesCampus = demandesValidees.filter((d) => d.lieuChambre);

  // Regroupe les étudiants validés directement par le quartier qu'ils ont
  // choisi dans leur demande — pas besoin de ressaisir l'appartement.
  const grouperParAppartement = () => {
    const groupes = {};
    demandesValideesAppartement.forEach((d) => {
      const cle = d.quartier === "Autre" ? (d.autreQuartier || "Autre") : d.quartier;
      if (!groupes[cle]) groupes[cle] = [];
      groupes[cle].push(d);
    });
    return groupes;
  };

  // Regroupe les étudiants du campus social/ESP/Claudel par lieu.
  const grouperParChambre = () => {
    const groupes = {};
    demandesValideesCampus.forEach((d) => {
      const cle = d.lieuChambre;
      if (!groupes[cle]) groupes[cle] = [];
      groupes[cle].push(d);
    });
    return groupes;
  };

  return (
    <div style={{ fontFamily: "'Segoe UI', Arial, sans-serif", margin: 0, backgroundColor: "white", minHeight: "100vh" }}>
      <nav style={{
        backgroundColor: bleuFonce,
        padding: "15px 20px",
        display: "flex",
        justifyContent: "center",
        gap: "15px"
      }}>
        <button
          onClick={() => setPage("accueil")}
          style={{
            backgroundColor: page === "accueil" ? "white" : "transparent",
            color: page === "accueil" ? bleuFonce : "white",
            border: "2px solid white",
            padding: "8px 20px",
            borderRadius: "25px",
            cursor: "pointer",
            fontWeight: "bold"
          }}
        >
          Accueil
        </button>
        <button
          onClick={() => setPage("gestion")}
          style={{
            backgroundColor: page === "gestion" ? "white" : "transparent",
            color: page === "gestion" ? bleuFonce : "white",
            border: "2px solid white",
            padding: "8px 20px",
            borderRadius: "25px",
            cursor: "pointer",
            fontWeight: "bold"
          }}
        >
          Espace gestion
        </button>
        <button
          onClick={() => setPage("campus")}
          style={{
            backgroundColor: page === "campus" ? "white" : "transparent",
            color: page === "campus" ? bleuFonce : "white",
            border: "2px solid white",
            padding: "8px 20px",
            borderRadius: "25px",
            cursor: "pointer",
            fontWeight: "bold"
          }}
        >
          Campus social
        </button>
      </nav>

      {page === "accueil" && (
        <>
          <div style={{
            background: `linear-gradient(180deg, #f0f6fc 0%, #d6e8fa 100%)`,
            textAlign: "center",
            padding: "40px 20px 0"
          }}>
            <img src={logo} alt="Logo AEERN" style={{ width: "160px", marginBottom: "20px" }} />
            <p style={{ fontFamily: "cursive", fontSize: "24px", color: bleuMoyen, margin: "0" }}>
              Bienvenue sur
            </p>
            <h1 style={{ fontSize: "42px", color: bleuFonce, margin: "5px 0 20px 0", letterSpacing: "1px" }}>
              KEUR BOU MAG BII
            </h1>
            <div style={{
              display: "inline-block",
              backgroundColor: bleuMoyen,
              color: "white",
              padding: "10px 25px",
              borderRadius: "20px",
              fontWeight: "bold",
              marginBottom: "10px"
            }}>
              Plateforme de gestion des logements
            </div>
            <p style={{ color: "#333", maxWidth: "500px", margin: "10px auto 24px" }}>
              des étudiants ressortissants de Ndiaganiao à l'UCAD
            </p>

            {/* Photo de l'équipe, avec le bas arrondi comme sur l'affiche */}
            <div style={{
              maxWidth: "700px",
              margin: "0 auto",
              borderRadius: "0 0 60px 60px",
              overflow: "hidden"
            }}>
              <img
                src={equipe}
                alt="Étudiants ressortissants de Ndiaganiao à l'UCAD"
                style={{ width: "100%", display: "block" }}
              />
            </div>

            {/* Bloc paiement du loyer via Wave */}
            <div style={{
              maxWidth: "700px",
              margin: "34px auto 0",
              backgroundColor: "white",
              border: `1.5px solid ${bleuMoyen}`,
              borderRadius: "18px",
              padding: "20px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "16px",
              boxShadow: "0 4px 20px rgba(13,59,102,0.06)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px", textAlign: "left" }}>
                <div style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  backgroundColor: "#eaf1fb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                  flexShrink: 0,
                }}>👛</div>
                <div>
                  <h3 style={{ color: bleuFonce, margin: 0, fontSize: "17px" }}>Payer mon loyer</h3>
                  <p style={{ color: "#777", fontSize: "13px", margin: "4px 0 0" }}>
                    Réglez votre loyer en toute sécurité via Wave.
                  </p>
                </div>
              </div>
              <a
                href={LIEN_WAVE}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "linear-gradient(135deg, #29c5e8, #1a8fd1)",
                  color: "white",
                  padding: "12px 26px",
                  borderRadius: "25px",
                  fontWeight: "bold",
                  textDecoration: "none",
                  fontSize: "15px",
                  whiteSpace: "nowrap"
                }}
              >
                🐧 Payer avec Wave
              </a>
            </div>

            {/* Bloc reçu de paiement — visible uniquement si connecté */}
            {session && !estAdmin && (
              <div style={{
                maxWidth: "700px",
                margin: "20px auto 0",
                backgroundColor: "white",
                border: `1.5px solid ${bleuMoyen}`,
                borderRadius: "18px",
                padding: "24px",
                textAlign: "left",
                boxShadow: "0 4px 20px rgba(13,59,102,0.06)"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "12px", backgroundColor: "#eaf1fb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>🧾</div>
                  <div>
                    <h3 style={{ color: bleuFonce, margin: 0, fontSize: "16px" }}>Mes reçus de paiement</h3>
                    <p style={{ color: "#777", fontSize: "13px", margin: "2px 0 0" }}>
                      Connecté en tant que {session.user.email}
                    </p>
                  </div>
                </div>

                {!recuEtudiant ? (
                  <p style={{ fontSize: "13px", color: "#777" }}>
                    Aucun logement validé associé à ton compte pour le moment.
                  </p>
                ) : recuLoyersPayes.length === 0 ? (
                  <p style={{ fontSize: "13px", color: "#777" }}>Aucun mois payé pour le moment.</p>
                ) : (
                  <div style={{ display: "grid", gap: "8px" }}>
                    {recuLoyersPayes.map((l) => (
                      <div key={l.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "#eaf1fb", padding: "10px 14px", borderRadius: "10px" }}>
                        <span style={{ fontSize: "14px", color: bleuFonce, fontWeight: "600" }}>{l.mois} {l.annee}</span>
                        <button
                          onClick={() => telechargerRecu(l)}
                          style={{ backgroundColor: bleuMoyen, color: "white", border: "none", padding: "6px 14px", borderRadius: "20px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}
                        >
                          ⬇ Télécharger le reçu
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ maxWidth: "600px", margin: "0 auto", padding: "20px" }}>
            {modeRecuperation ? (
              <div style={{
                backgroundColor: "white",
                border: `1.5px solid ${bleuMoyen}`,
                borderRadius: "18px",
                padding: "26px 24px",
                boxShadow: "0 4px 20px rgba(13,59,102,0.06)"
              }}>
                <h3 style={{ color: bleuFonce, marginTop: 0, textAlign: "center" }}>Nouveau mot de passe</h3>
                <p style={{ color: "#777", fontSize: "13px", textAlign: "center", marginTop: "-6px" }}>
                  Choisis un nouveau mot de passe pour ton compte.
                </p>
                <form onSubmit={definirNouveauMotDePasse}>
                  <div style={{ marginBottom: "12px", position: "relative" }}>
                    <input
                      type={afficherNouveauMotDePasse ? "text" : "password"}
                      placeholder="Nouveau mot de passe"
                      value={nouveauMotDePasse}
                      onChange={(e) => setNouveauMotDePasse(e.target.value)}
                      required
                      minLength={6}
                      style={{ width: "100%", padding: "11px 40px 11px 12px", borderRadius: "10px", border: `1.5px solid ${bleuMoyen}`, fontSize: "14px", boxSizing: "border-box" }}
                    />
                    <button
                      type="button"
                      onClick={() => setAfficherNouveauMotDePasse(!afficherNouveauMotDePasse)}
                      style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: "16px" }}
                    >
                      {afficherNouveauMotDePasse ? "🙈" : "👁️"}
                    </button>
                  </div>
                  {erreurNouveauMotDePasse && <p style={{ color: "red", fontSize: "13px" }}>{erreurNouveauMotDePasse}</p>}
                  {messageNouveauMotDePasse && <p style={{ color: "#1e7d3a", fontSize: "13px" }}>{messageNouveauMotDePasse}</p>}
                  <button
                    type="submit"
                    style={{
                      width: "100%",
                      background: `linear-gradient(135deg, ${bleuMoyen}, ${bleuFonce})`,
                      color: "white",
                      border: "none",
                      padding: "12px",
                      borderRadius: "10px",
                      cursor: "pointer",
                      fontWeight: "bold",
                      fontSize: "14px",
                    }}
                  >
                    Valider le nouveau mot de passe
                  </button>
                </form>
              </div>
            ) : !session ? (
              <div style={{
                backgroundColor: "white",
                border: `1.5px solid ${bleuMoyen}`,
                borderRadius: "18px",
                padding: "26px 24px",
                boxShadow: "0 4px 20px rgba(13,59,102,0.06)"
              }}>
                {modeMotDePasseOublie ? (
                  <>
                    <h3 style={{ color: bleuFonce, marginTop: 0, textAlign: "center" }}>Mot de passe oublié</h3>
                    <p style={{ color: "#777", fontSize: "13px", textAlign: "center", marginTop: "-6px" }}>
                      Entre ton email, tu recevras un lien pour créer un nouveau mot de passe.
                    </p>
                    <form onSubmit={demanderReinitialisation}>
                      <div style={{ marginBottom: "12px" }}>
                        <input
                          type="email"
                          placeholder="Adresse email"
                          value={emailRecuperation}
                          onChange={(e) => setEmailRecuperation(e.target.value)}
                          required
                          style={{ width: "100%", padding: "11px 12px", borderRadius: "10px", border: `1.5px solid ${bleuMoyen}`, fontSize: "14px", boxSizing: "border-box" }}
                        />
                      </div>
                      {erreurRecuperation && <p style={{ color: "red", fontSize: "13px" }}>{erreurRecuperation}</p>}
                      {messageRecuperation && <p style={{ color: "#1e7d3a", fontSize: "13px" }}>{messageRecuperation}</p>}
                      <button
                        type="submit"
                        style={{
                          width: "100%",
                          background: `linear-gradient(135deg, ${bleuMoyen}, ${bleuFonce})`,
                          color: "white",
                          border: "none",
                          padding: "12px",
                          borderRadius: "10px",
                          cursor: "pointer",
                          fontWeight: "bold",
                          fontSize: "14px",
                        }}
                      >
                        Envoyer le lien de réinitialisation
                      </button>
                    </form>
                    <p style={{ textAlign: "center", fontSize: "13px", marginTop: "14px" }}>
                      <button
                        onClick={() => { setModeMotDePasseOublie(false); setErreurRecuperation(""); setMessageRecuperation(""); }}
                        style={{ background: "none", border: "none", color: bleuMoyen, textDecoration: "underline", cursor: "pointer", fontWeight: "600" }}
                      >
                        Retour à la connexion
                      </button>
                    </p>
                  </>
                ) : (
                  <>
                    <h3 style={{ color: bleuFonce, marginTop: 0, textAlign: "center" }}>
                      {modeInscription ? "Créer mon compte étudiant" : "Se connecter pour faire une demande"}
                    </h3>
                    <p style={{ color: "#777", fontSize: "13px", textAlign: "center", marginTop: "-6px" }}>
                      Un compte est nécessaire pour envoyer une demande de logement et suivre tes reçus de paiement.
                    </p>
                    <form onSubmit={modeInscription ? inscrireEtudiant : connecterEtudiant}>
                      <div style={{ marginBottom: "12px" }}>
                        <input
                          type="email"
                          placeholder="Adresse email"
                          value={compteEmail}
                          onChange={(e) => setCompteEmail(e.target.value)}
                          required
                          style={{ width: "100%", padding: "11px 12px", borderRadius: "10px", border: `1.5px solid ${bleuMoyen}`, fontSize: "14px", boxSizing: "border-box" }}
                        />
                      </div>
                      <div style={{ marginBottom: "6px", position: "relative" }}>
                        <input
                          type={afficherMotDePasseCompte ? "text" : "password"}
                          placeholder="Mot de passe"
                          value={compteMotDePasse}
                          onChange={(e) => setCompteMotDePasse(e.target.value)}
                          required
                          minLength={6}
                          style={{ width: "100%", padding: "11px 40px 11px 12px", borderRadius: "10px", border: `1.5px solid ${bleuMoyen}`, fontSize: "14px", boxSizing: "border-box" }}
                        />
                        <button
                          type="button"
                          onClick={() => setAfficherMotDePasseCompte(!afficherMotDePasseCompte)}
                          style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: "16px" }}
                        >
                          {afficherMotDePasseCompte ? "🙈" : "👁️"}
                        </button>
                      </div>
                      {modeInscription && (
                        <p style={{ fontSize: "12px", color: "#888", margin: "0 0 12px" }}>
                          Astuce : tu peux utiliser ton numéro de carte étudiant comme mot de passe pour t'en souvenir facilement.
                        </p>
                      )}
                      {!modeInscription && (
                        <p style={{ textAlign: "right", marginTop: "6px", marginBottom: "12px" }}>
                          <button
                            type="button"
                            onClick={() => { setModeMotDePasseOublie(true); setErreurCompte(""); setMessageCompte(""); }}
                            style={{ background: "none", border: "none", color: bleuMoyen, textDecoration: "underline", cursor: "pointer", fontSize: "12px" }}
                          >
                            Mot de passe oublié ?
                          </button>
                        </p>
                      )}
                      {erreurCompte && <p style={{ color: "red", fontSize: "13px" }}>{erreurCompte}</p>}
                      {messageCompte && <p style={{ color: "#1e7d3a", fontSize: "13px" }}>{messageCompte}</p>}
                      <button
                        type="submit"
                        style={{
                          width: "100%",
                          background: `linear-gradient(135deg, ${bleuMoyen}, ${bleuFonce})`,
                          color: "white",
                          border: "none",
                          padding: "12px",
                          borderRadius: "10px",
                          cursor: "pointer",
                          fontWeight: "bold",
                          fontSize: "14px",
                        }}
                      >
                        {modeInscription ? "Créer mon compte" : "Se connecter"}
                      </button>
                    </form>
                    <p style={{ textAlign: "center", fontSize: "13px", marginTop: "14px" }}>
                      {modeInscription ? "Déjà un compte ?" : "Pas encore de compte ?"}{" "}
                      <button
                        onClick={() => { setModeInscription(!modeInscription); setErreurCompte(""); setMessageCompte(""); }}
                        style={{ background: "none", border: "none", color: bleuMoyen, textDecoration: "underline", cursor: "pointer", fontWeight: "600" }}
                      >
                        {modeInscription ? "Se connecter" : "Créer un compte"}
                      </button>
                    </p>
                  </>
                )}
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <p style={{ color: "#555", fontSize: "13px", margin: 0 }}>
                    Connecté en tant que <strong>{session.user.email}</strong>
                  </p>
                  <button
                    onClick={seDeconnecter}
                    style={{ backgroundColor: "#555", color: "white", border: "none", padding: "6px 14px", borderRadius: "16px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}
                  >
                    Se déconnecter
                  </button>
                </div>
                <DemandeForm onSubmitDemande={ajouterDemande} userId={session.user.id} />
              </>
            )}
          </div>

          <div style={{
            backgroundColor: bleuFonce,
            padding: "40px 20px",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "30px",
            marginTop: "30px"
          }}>
            {[
              { titre: "TROUVER UN LOGEMENT", texte: "Recherchez facilement un logement adapté à vos besoins." },
              { titre: "GESTION FACILITÉE", texte: "Gérez vos demandes en toute simplicité." },
              { titre: "SÉCURITÉ GARANTIE", texte: "Des logements vérifiés pour votre tranquillité d'esprit." },
              { titre: "NOTIFICATIONS EN TEMPS RÉEL", texte: "Restez informé des nouvelles offres et mises à jour." }
            ].map((carte, i) => (
              <div key={i} style={{ textAlign: "center", maxWidth: "180px", color: "white" }}>
                <h3 style={{ fontSize: "15px", marginBottom: "8px" }}>{carte.titre}</h3>
                <p style={{ fontSize: "13px", color: "#cfe0f5" }}>{carte.texte}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {page === "gestion" && !authentifie && (
        <div style={{
          maxWidth: "400px",
          margin: "80px auto",
          padding: "30px",
          border: `2px solid ${bleuFonce}`,
          borderRadius: "10px",
          textAlign: "center"
        }}>
          <h2 style={{ color: bleuFonce }}>Accès Espace gestion</h2>
          <p style={{ color: "#555" }}>Cette section est réservée aux responsables de l'amicale.</p>
          <form onSubmit={verifierMotDePasse}>
            <input
              type="email"
              placeholder="Adresse email"
              value={emailSaisi}
              onChange={(e) => setEmailSaisi(e.target.value)}
              style={{ width: "100%", padding: "10px", marginBottom: "10px", borderRadius: "5px", border: "1px solid #ccc" }}
            />
            <div style={{ position: "relative", marginBottom: "10px" }}>
              <input
                type={afficherMotDePasseAdmin ? "text" : "password"}
                placeholder="Mot de passe"
                value={motDePasseSaisi}
                onChange={(e) => setMotDePasseSaisi(e.target.value)}
                style={{ width: "100%", padding: "10px", paddingRight: "40px", borderRadius: "5px", border: "1px solid #ccc", boxSizing: "border-box" }}
              />
              <button
                type="button"
                onClick={() => setAfficherMotDePasseAdmin(!afficherMotDePasseAdmin)}
                style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: "16px" }}
              >
                {afficherMotDePasseAdmin ? "🙈" : "👁️"}
              </button>
            </div>
            {erreurMdp && <p style={{ color: "red" }}>{erreurMdp}</p>}
            <button
              type="submit"
              style={{
                backgroundColor: bleuFonce,
                color: "white",
                border: "none",
                padding: "10px 25px",
                borderRadius: "25px",
                cursor: "pointer",
                fontWeight: "bold"
              }}
            >
              Se connecter
            </button>
          </form>
        </div>
      )}

      {page === "gestion" && authentifie && (
        <div style={{ backgroundColor: bleuNuit, minHeight: "100vh", padding: "24px 16px" }}>
          <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "12px", backgroundColor: "#1e5fa8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>📋</div>
                <h2 style={{ color: "white", margin: 0, fontSize: "19px" }}>Espace gestion — Demandes reçues ({demandes.length})</h2>
              </div>
              <button
                onClick={seDeconnecter}
                style={{ backgroundColor: "#1a2f5c", color: "white", border: "none", padding: "10px 18px", borderRadius: "20px", cursor: "pointer", fontWeight: "bold", display: "flex", alignItems: "center", gap: "6px" }}
              >
                ⏻ Se déconnecter
              </button>
            </div>

            {chargement ? (
              <p style={{ color: "white" }}>Chargement...</p>
            ) : demandes.length === 0 ? (
              <p style={{ color: "white" }}>Aucune demande pour le moment.</p>
            ) : (
              <div style={{ backgroundColor: "#132a5e", borderRadius: "14px", padding: "8px", marginBottom: "30px", overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", color: "white", minWidth: "900px" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #24417f" }}>
                      <th style={{ textAlign: "left", padding: "12px" }}>Nom</th>
                      <th style={{ textAlign: "left", padding: "12px" }}>Prénom</th>
                      <th style={{ textAlign: "left", padding: "12px" }}>Filière</th>
                      <th style={{ textAlign: "left", padding: "12px" }}>N° carte étudiant</th>
                      <th style={{ textAlign: "left", padding: "12px" }}>Téléphone</th>
                      <th style={{ textAlign: "left", padding: "12px" }}>Quartier</th>
                      <th style={{ textAlign: "left", padding: "12px" }}>Certificat</th>
                      <th style={{ textAlign: "left", padding: "12px" }}>Statut</th>
                      <th style={{ textAlign: "left", padding: "12px" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {demandes.map((d) => (
                      <tr key={d.id} style={{ borderBottom: "1px solid #1e3564" }}>
                        <td style={{ padding: "12px" }}>{d.nom}</td>
                        <td style={{ padding: "12px" }}>{d.prenom}</td>
                        <td style={{ padding: "12px" }}>{d.filiere}</td>
                        <td style={{ padding: "12px" }}>{d.numeroCarteEtudiant}</td>
                        <td style={{ padding: "12px" }}>{d.telephone}</td>
                        <td style={{ padding: "12px" }}>
                          {d.quartier
                            ? (d.quartier === "Autre" ? d.autreQuartier : d.quartier)
                            : d.lieuChambre
                            ? `${d.lieuChambre} (chambre ${d.numeroChambre || "?"})`
                            : "—"}
                        </td>
                        <td style={{ padding: "12px" }}>
                          {d.certificat ? (
                            <button
                              onClick={() => voirCertificat(d.certificat)}
                              style={{ background: "none", border: "none", color: "#7fb3ff", textDecoration: "underline", cursor: "pointer", padding: 0, font: "inherit" }}
                            >
                              Voir
                            </button>
                          ) : "—"}
                        </td>
                        <td style={{ padding: "12px" }}>
                          {badgeStatut(d.statut)}
                        </td>
                        <td style={{ padding: "12px" }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                            <button onClick={() => changerStatut(d.id, "validée")} style={{ backgroundColor: "#2e7d32", color: "white", border: "none", padding: "6px 10px", borderRadius: "20px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}>Valider</button>
                            <button onClick={() => changerStatut(d.id, "non validée")} style={{ backgroundColor: "#c62828", color: "white", border: "none", padding: "6px 10px", borderRadius: "20px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}>Refuser</button>
                            <button onClick={() => changerStatut(d.id, "en attente")} style={{ backgroundColor: "#e0a020", color: "white", border: "none", padding: "6px 10px", borderRadius: "20px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}>Remettre en attente</button>
                            <button onClick={() => supprimerDemande(d.id)} style={{ backgroundColor: "#3a4a6b", color: "white", border: "none", padding: "6px 10px", borderRadius: "20px", cursor: "pointer", fontSize: "12px", fontWeight: "bold" }}>Supprimer</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "30px 0 14px" }}>
              <div style={{ width: "34px", height: "34px", borderRadius: "10px", backgroundColor: "#1e5fa8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>🏢</div>
              <h2 style={{ color: "white", margin: 0, fontSize: "17px" }}>Logements par appartement</h2>
            </div>
            {demandesValideesAppartement.length === 0 ? (
              <p style={{ color: "#cfd8ec" }}>Aucun étudiant avec un logement validé pour le moment.</p>
            ) : (
              <div style={{ marginBottom: "40px", display: "grid", gap: "14px" }}>
                {Object.entries(grouperParAppartement()).map(([nomAppart, etudiants]) => (
                  <div
                    key={nomAppart}
                    style={{
                      backgroundColor: "white",
                      borderRadius: "14px",
                      padding: "16px 20px",
                      display: "flex",
                      gap: "14px",
                      borderLeft: `5px solid ${bleuMoyen}`,
                    }}
                  >
                    <div style={{ width: "38px", height: "38px", borderRadius: "10px", backgroundColor: "#eaf1fb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "17px", flexShrink: 0 }}>🏠</div>
                    <div>
                      <h3 style={{ color: bleuFonce, marginTop: 0, marginBottom: "6px", fontSize: "15px" }}>
                        {nomAppart} <span style={{ color: "#888", fontWeight: "normal" }}>({etudiants.length} étudiant{etudiants.length > 1 ? "s" : ""})</span>
                      </h3>
                      <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "14px", color: "#333" }}>
                        {etudiants.map((e) => (
                          <li key={e.id} style={{ marginBottom: "4px" }}>
                            {e.nom} {e.prenom} — {e.telephone} — {e.filiere} {e.niveau}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "30px 0 14px" }}>
              <div style={{ width: "34px", height: "34px", borderRadius: "10px", backgroundColor: "#1e5fa8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>🛏️</div>
              <h2 style={{ color: "white", margin: 0, fontSize: "17px" }}>Chambres — Campus social / ESP / Claudel</h2>
            </div>
            {demandesValideesCampus.length === 0 ? (
              <p style={{ color: "#cfd8ec" }}>Aucun étudiant validé dans ces chambres pour le moment.</p>
            ) : (
              <div style={{ marginBottom: "40px", display: "grid", gap: "14px" }}>
                {Object.entries(grouperParChambre()).map(([lieu, etudiants]) => (
                  <div
                    key={lieu}
                    style={{
                      backgroundColor: "white",
                      borderRadius: "14px",
                      padding: "16px 20px",
                      display: "flex",
                      gap: "14px",
                      borderLeft: `5px solid #2e9e8f`,
                    }}
                  >
                    <div style={{ width: "38px", height: "38px", borderRadius: "10px", backgroundColor: "#e3f6f3", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "17px", flexShrink: 0 }}>🛏️</div>
                    <div>
                      <h3 style={{ color: bleuFonce, marginTop: 0, marginBottom: "6px", fontSize: "15px" }}>
                        {lieu} <span style={{ color: "#888", fontWeight: "normal" }}>({etudiants.length} étudiant{etudiants.length > 1 ? "s" : ""})</span>
                      </h3>
                      <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "14px", color: "#333" }}>
                        {etudiants.map((e) => (
                          <li key={e.id} style={{ marginBottom: "4px" }}>
                            Chambre {e.numeroChambre || "?"} — {e.nom} {e.prenom} — {e.telephone} — {e.filiere} {e.niveau}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "30px 0 14px" }}>
              <div style={{ width: "34px", height: "34px", borderRadius: "10px", backgroundColor: "#1e5fa8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>🏠</div>
              <h2 style={{ color: "white", margin: 0, fontSize: "17px" }}>Suivi des loyers</h2>
            </div>
            {demandesValideesAppartement.length === 0 ? (
              <p style={{ color: "#cfd8ec" }}>Aucun étudiant avec un logement validé pour le moment.</p>
            ) : (
              <div style={{ backgroundColor: "white", borderRadius: "14px", padding: "16px", overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${bleuFonce}` }}>
                      <th style={{ textAlign: "left", padding: "8px", position: "sticky", left: 0, backgroundColor: "white" }}>Étudiant</th>
                      {ORDRE_ANNEE_SCOLAIRE.map((m) => (
                        <th key={m} style={{ padding: "8px", fontSize: "12px" }}>{m.slice(0, 3)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {demandesValideesAppartement.map((d) => {
                      const loyersEtudiant = loyers.filter((l) => l.demande_id === d.id);
                      return (
                        <tr key={d.id} style={{ borderBottom: "1px solid #ccc" }}>
                          <td style={{ padding: "8px", fontWeight: "bold", position: "sticky", left: 0, backgroundColor: "white" }}>
                            {d.nom} {d.prenom}
                          </td>
                          {ORDRE_ANNEE_SCOLAIRE.map((m) => {
                            const loyerMois = loyersEtudiant.find((l) => l.mois === m);
                            const paye = loyerMois?.paye;
                            return (
                              <td key={m} style={{ textAlign: "center", padding: "4px" }}>
                                <span style={{
                                  display: "inline-block",
                                  width: "20px",
                                  height: "20px",
                                  borderRadius: "50%",
                                  backgroundColor: paye ? "#2e7d32" : "#ddd"
                                }} title={paye ? "Payé" : "Non payé"}></span>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p style={{ fontSize: "13px", color: "#777", marginTop: "10px" }}>
                  🟢 Payé &nbsp;&nbsp; ⚪ Non payé — Le paiement en ligne sera bientôt activé.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {page === "campus" && !authentifieCampus && (
        <div style={{
          maxWidth: "400px",
          margin: "80px auto",
          padding: "30px",
          backgroundColor: "#faf7f0",
          border: "1.5px solid #1e5fa8",
          borderRadius: "12px",
          textAlign: "center",
          fontFamily: "'Segoe UI', Arial, sans-serif"
        }}>
          <h2 style={{ color: bleuFonce }}>Accès Campus social</h2>
          <p style={{ color: "#555" }}>Espace réservé à la gestion des chambres au campus social, à l'ESP et à Claudel.</p>
          <form onSubmit={verifierMotDePasseCampus}>
            <div style={{ position: "relative", marginBottom: "10px" }}>
              <input
                type={afficherMotDePasseCampus ? "text" : "password"}
                placeholder="Mot de passe"
                value={motDePasseCampusSaisi}
                onChange={(e) => setMotDePasseCampusSaisi(e.target.value)}
                style={{ width: "100%", padding: "12px 40px 12px 14px", borderRadius: "10px", border: "1.5px solid #1e5fa8", backgroundColor: "#fdfcf9", color: "#1a1a1a", fontSize: "15px", boxSizing: "border-box" }}
              />
              <button
                type="button"
                onClick={() => setAfficherMotDePasseCampus(!afficherMotDePasseCampus)}
                style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: "16px" }}
              >
                {afficherMotDePasseCampus ? "🙈" : "👁️"}
              </button>
            </div>
            {erreurCampus && <p style={{ color: "red" }}>{erreurCampus}</p>}
            <button
              type="submit"
              style={{
                backgroundColor: bleuFonce,
                color: "white",
                border: "none",
                padding: "10px 25px",
                borderRadius: "25px",
                cursor: "pointer",
                fontWeight: "bold"
              }}
            >
              Se connecter
            </button>
          </form>
        </div>
      )}

      {page === "campus" && authentifieCampus && (
        <div style={{ padding: "24px 16px", maxWidth: "700px", margin: "0 auto", fontFamily: "'Segoe UI', Arial, sans-serif" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "10px" }}>
            <div style={{
              width: "48px", height: "48px", borderRadius: "50%",
              backgroundColor: "#eaf1fb", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: "20px", flexShrink: 0,
            }}>➕👤</div>
            <div>
              <h2 style={{ color: bleuFonce, margin: 0, fontSize: "18px" }}>Ajouter un étudiant — Campus social / ESP / Claudel</h2>
              <p style={{ color: "#777", fontSize: "13px", margin: "4px 0 0" }}>
                L'étudiant ajouté ici apparaîtra en attente de validation dans l'Espace gestion.
                Une fois validé, il n'apparaîtra pas dans le suivi des loyers.
              </p>
            </div>
          </div>

          <form onSubmit={ajouterEtudiantCampus} style={{
            marginTop: "20px",
            marginBottom: "40px",
            backgroundColor: "white",
            padding: "24px",
            borderRadius: "16px",
            boxShadow: "0 4px 20px rgba(13,59,102,0.08)",
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "18px 20px" }}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "700", color: bleuFonce, display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                  👤 Nom <span style={{ color: "#e0574c" }}>*</span>
                </label>
                <input type="text" name="nom" value={campusFormData.nom} onChange={handleCampusChange} required placeholder="Tine" style={{ width: "100%", padding: "11px 12px", borderRadius: "10px", border: `1.5px solid ${bleuMoyen}`, backgroundColor: "white", color: "#1a1a1a", fontSize: "14px", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "700", color: bleuFonce, display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                  👤 Prénom <span style={{ color: "#e0574c" }}>*</span>
                </label>
                <input type="text" name="prenom" value={campusFormData.prenom} onChange={handleCampusChange} required placeholder="Maurice Latyr" style={{ width: "100%", padding: "11px 12px", borderRadius: "10px", border: `1.5px solid ${bleuMoyen}`, backgroundColor: "white", color: "#1a1a1a", fontSize: "14px", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "700", color: bleuFonce, display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                  📞 Téléphone <span style={{ color: "#e0574c" }}>*</span>
                </label>
                <input type="tel" name="telephone" value={campusFormData.telephone} onChange={handleCampusChange} required placeholder="77 123 45 67" style={{ width: "100%", padding: "11px 12px", borderRadius: "10px", border: `1.5px solid ${bleuMoyen}`, backgroundColor: "white", color: "#1a1a1a", fontSize: "14px", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "700", color: bleuFonce, display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>🎓 Filière</label>
                <input type="text" name="filiere" value={campusFormData.filiere} onChange={handleCampusChange} placeholder="Ex: Mathématiques" style={{ width: "100%", padding: "11px 12px", borderRadius: "10px", border: `1.5px solid ${bleuMoyen}`, backgroundColor: "white", color: "#1a1a1a", fontSize: "14px", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "700", color: bleuFonce, display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>📖 Niveau</label>
                <input type="text" name="niveau" value={campusFormData.niveau} onChange={handleCampusChange} placeholder="Ex: Licence 2" style={{ width: "100%", padding: "11px 12px", borderRadius: "10px", border: `1.5px solid ${bleuMoyen}`, backgroundColor: "white", color: "#1a1a1a", fontSize: "14px", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "700", color: bleuFonce, display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                  🏢 Lieu <span style={{ color: "#e0574c" }}>*</span>
                </label>
                <select name="lieuChambre" value={campusFormData.lieuChambre} onChange={handleCampusChange} style={{ width: "100%", padding: "11px 12px", borderRadius: "10px", border: `1.5px solid ${bleuMoyen}`, backgroundColor: "white", color: "#1a1a1a", fontSize: "14px", boxSizing: "border-box" }}>
                  {LIEUX_CHAMBRE.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: "13px", fontWeight: "700", color: bleuFonce, display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                  🛏️ Numéro de chambre <span style={{ color: "#e0574c" }}>*</span>
                </label>
                <input type="text" name="numeroChambre" value={campusFormData.numeroChambre} onChange={handleCampusChange} required placeholder="Ex: 12" style={{ width: "100%", padding: "11px 12px", borderRadius: "10px", border: `1.5px solid ${bleuMoyen}`, backgroundColor: "white", color: "#1a1a1a", fontSize: "14px", boxSizing: "border-box" }} />
              </div>
            </div>

            <div style={{ marginTop: "18px" }}>
              <label
                htmlFor="campus-certificat-input"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  border: `1.5px solid ${bleuMoyen}`,
                  borderRadius: "12px",
                  backgroundColor: "#eaf1fb",
                  padding: "14px 18px",
                  cursor: "pointer",
                }}
              >
                <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>📄</div>
                <div>
                  <p style={{ margin: 0, fontWeight: "700", color: bleuFonce, fontSize: "14px" }}>Certificat d'inscription (PDF ou image)</p>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: "6px",
                    backgroundColor: bleuMoyen, color: "white", padding: "6px 14px",
                    borderRadius: "20px", fontSize: "12px", fontWeight: "600", marginTop: "6px",
                  }}>
                    ⬆ Choisir un fichier
                  </span>
                  <span style={{ marginLeft: "8px", fontSize: "12px", color: "#777" }}>
                    {campusCertificatFile ? campusCertificatFile.name : "Aucun fichier choisi"}
                  </span>
                </div>
                <input
                  id="campus-certificat-input"
                  type="file"
                  name="certificat"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setCampusCertificatFile(e.target.files[0])}
                  style={{ display: "none" }}
                />
              </label>
            </div>

            <button
              type="submit"
              style={{
                width: "100%",
                marginTop: "22px",
                background: `linear-gradient(135deg, ${bleuMoyen}, ${bleuFonce})`,
                color: "white",
                border: "none",
                padding: "14px",
                borderRadius: "12px",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "15px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              ➕ Ajouter l'étudiant
            </button>
          </form>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "30px 0 16px" }}>
            <div style={{ width: "34px", height: "34px", borderRadius: "50%", backgroundColor: "#eaf1fb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px" }}>👥</div>
            <h2 style={{ color: bleuFonce, margin: 0, fontSize: "17px" }}>Étudiants enregistrés</h2>
          </div>

          {demandes.filter((d) => d.lieuChambre).length === 0 ? (
            <p style={{ color: "#777" }}>Aucun étudiant enregistré pour le moment.</p>
          ) : (
            Object.entries(
              demandes
                .filter((d) => d.lieuChambre)
                .reduce((groupes, d) => {
                  const cle = d.lieuChambre;
                  if (!groupes[cle]) groupes[cle] = [];
                  groupes[cle].push(d);
                  return groupes;
                }, {})
            ).map(([lieu, etudiants]) => (
              <div key={lieu} style={{ marginBottom: "22px" }}>
                <h3 style={{ color: bleuMoyen, marginBottom: "10px", fontSize: "14px" }}>{lieu}</h3>
                <div style={{ display: "grid", gap: "10px" }}>
                  {etudiants.map((e) => (
                    <div
                      key={e.id}
                      style={{
                        backgroundColor: "white",
                        borderRadius: "12px",
                        padding: "14px 18px",
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                        borderLeft: `4px solid ${e.statut === "validée" ? "#2e9e5c" : e.statut === "non validée" ? "#c0392b" : "#e0a020"}`,
                        boxShadow: "0 2px 8px rgba(13,59,102,0.06)",
                      }}
                    >
                      <div style={{ width: "34px", height: "34px", borderRadius: "10px", backgroundColor: "#eaf1fb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: 0 }}>🛏️</div>
                      <div style={{ flex: 1, fontSize: "14px", color: "#333" }}>
                        <strong>Chambre {e.numeroChambre || "?"}</strong> — {e.nom} {e.prenom} — {e.telephone}{" "}
                        {badgeStatut(e.statut)}
                        {e.certificat && (
                          <>
                            {" "}
                            <button
                              onClick={() => voirCertificat(e.certificat)}
                              style={{ background: "none", border: "none", color: bleuMoyen, textDecoration: "underline", cursor: "pointer", padding: 0, font: "inherit" }}
                            >
                              Voir le certificat
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default App; 
