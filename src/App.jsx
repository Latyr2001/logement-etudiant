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

  const EMAILJS_SERVICE_ID = "service_omlh6vq";
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

  useEffect(() => {
    chargerDemandes();
    chargerLoyers();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthentifie(!!session);
    });

    const { data: ecouteur } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthentifie(!!session);
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
          </div>

          <div style={{ maxWidth: "600px", margin: "0 auto", padding: "20px" }}>
            <p style={{ textAlign: "center", color: "#555" }}>
              Bienvenue sur la plateforme officielle de demande de logement.
            </p>
            <DemandeForm onSubmitDemande={ajouterDemande} />
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
            <input
              type="password"
              placeholder="Mot de passe"
              value={motDePasseSaisi}
              onChange={(e) => setMotDePasseSaisi(e.target.value)}
              style={{ width: "100%", padding: "10px", marginBottom: "10px", borderRadius: "5px", border: "1px solid #ccc" }}
            />
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
        <div style={{ padding: "20px", maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ color: bleuFonce }}>Espace gestion — Demandes reçues ({demandes.length})</h2>
            <button
              onClick={seDeconnecter}
              style={{ backgroundColor: "#555", color: "white", border: "none", padding: "8px 18px", borderRadius: "20px", cursor: "pointer", fontWeight: "bold" }}
            >
              Se déconnecter
            </button>
          </div>
          {chargement ? (
            <p>Chargement...</p>
          ) : demandes.length === 0 ? (
            <p>Aucune demande pour le moment.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "50px" }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${bleuFonce}` }}>
                  <th style={{ textAlign: "left", padding: "8px" }}>Nom</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Prénom</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Filière</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>N° carte étudiant</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Téléphone</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Quartier</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Certificat</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Statut</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {demandes.map((d) => (
                  <tr key={d.id} style={{ borderBottom: "1px solid #ccc" }}>
                    <td style={{ padding: "8px" }}>{d.nom}</td>
                    <td style={{ padding: "8px" }}>{d.prenom}</td>
                    <td style={{ padding: "8px" }}>{d.filiere}</td>
                    <td style={{ padding: "8px" }}>{d.numeroCarteEtudiant}</td>
                    <td style={{ padding: "8px" }}>{d.telephone}</td>
                    <td style={{ padding: "8px" }}>
                      {d.quartier
                        ? (d.quartier === "Autre" ? d.autreQuartier : d.quartier)
                        : d.lieuChambre
                        ? `${d.lieuChambre} (chambre ${d.numeroChambre || "?"})`
                        : "—"}
                    </td>
                    <td style={{ padding: "8px" }}>
                      {d.certificat ? (
                        <button
                          onClick={() => voirCertificat(d.certificat)}
                          style={{ background: "none", border: "none", color: "#1e5fa8", textDecoration: "underline", cursor: "pointer", padding: 0, font: "inherit" }}
                        >
                          Voir
                        </button>
                      ) : "—"}
                    </td>
                    <td style={{ padding: "8px", fontWeight: "bold", color: couleurStatut(d.statut) }}>
                      {d.statut}
                    </td>
                    <td style={{ padding: "8px" }}>
                      <button onClick={() => changerStatut(d.id, "validée")} style={{ marginRight: "5px", marginBottom: "4px", backgroundColor: "#2e7d32", color: "white", border: "none", padding: "4px 8px", borderRadius: "4px", cursor: "pointer" }}>Valider</button>
                      <button onClick={() => changerStatut(d.id, "non validée")} style={{ marginRight: "5px", marginBottom: "4px", backgroundColor: "#c62828", color: "white", border: "none", padding: "4px 8px", borderRadius: "4px", cursor: "pointer" }}>Refuser</button>
                      <button onClick={() => changerStatut(d.id, "en attente")} style={{ marginRight: "5px", marginBottom: "4px", backgroundColor: "#f9a825", color: "white", border: "none", padding: "4px 8px", borderRadius: "4px", cursor: "pointer" }}>Remettre en attente</button>
                      <button onClick={() => supprimerDemande(d.id)} style={{ backgroundColor: "#555", color: "white", border: "none", padding: "4px 8px", borderRadius: "4px", cursor: "pointer" }}>Supprimer</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h2 style={{ color: bleuFonce }}>Logements par appartement</h2>
          {demandesValideesAppartement.length === 0 ? (
            <p>Aucun étudiant avec un logement validé pour le moment.</p>
          ) : (
            <div style={{ marginBottom: "50px" }}>
              {Object.entries(grouperParAppartement()).map(([nomAppart, etudiants]) => (
                <div
                  key={nomAppart}
                  style={{
                    marginBottom: "18px",
                    border: `1px solid ${bleuMoyen}`,
                    borderRadius: "8px",
                    padding: "14px 18px"
                  }}
                >
                  <h3 style={{ color: bleuMoyen, marginTop: 0, marginBottom: "8px" }}>
                    {nomAppart} <span style={{ color: "#777", fontWeight: "normal" }}>({etudiants.length} étudiant{etudiants.length > 1 ? "s" : ""})</span>
                  </h3>
                  <ul style={{ margin: 0, paddingLeft: "20px" }}>
                    {etudiants.map((e) => (
                      <li key={e.id} style={{ marginBottom: "4px" }}>
                        {e.nom} {e.prenom} — {e.telephone} — {e.filiere} {e.niveau}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <h2 style={{ color: bleuFonce }}>Chambres — Campus social / ESP / Claudel</h2>
          {demandesValideesCampus.length === 0 ? (
            <p>Aucun étudiant validé dans ces chambres pour le moment.</p>
          ) : (
            <div style={{ marginBottom: "50px" }}>
              {Object.entries(grouperParChambre()).map(([lieu, etudiants]) => (
                <div
                  key={lieu}
                  style={{
                    marginBottom: "18px",
                    border: `1px solid ${bleuMoyen}`,
                    borderRadius: "8px",
                    padding: "14px 18px"
                  }}
                >
                  <h3 style={{ color: bleuMoyen, marginTop: 0, marginBottom: "8px" }}>
                    {lieu} <span style={{ color: "#777", fontWeight: "normal" }}>({etudiants.length} étudiant{etudiants.length > 1 ? "s" : ""})</span>
                  </h3>
                  <ul style={{ margin: 0, paddingLeft: "20px" }}>
                    {etudiants.map((e) => (
                      <li key={e.id} style={{ marginBottom: "4px" }}>
                        Chambre {e.numeroChambre || "?"} — {e.nom} {e.prenom} — {e.telephone} — {e.filiere} {e.niveau}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <h2 style={{ color: bleuFonce }}>Suivi des loyers</h2>
          {demandesValideesAppartement.length === 0 ? (
            <p>Aucun étudiant avec un logement validé pour le moment.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
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
            <input
              type="password"
              placeholder="Mot de passe"
              value={motDePasseCampusSaisi}
              onChange={(e) => setMotDePasseCampusSaisi(e.target.value)}
              style={{ width: "100%", padding: "12px 14px", marginBottom: "10px", borderRadius: "10px", border: "1.5px solid #1e5fa8", backgroundColor: "#fdfcf9", color: "#1a1a1a", fontSize: "15px", boxSizing: "border-box" }}
            />
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
        <div style={{ padding: "20px", maxWidth: "700px", margin: "0 auto", fontFamily: "'Segoe UI', Arial, sans-serif" }}>
          <h2 style={{ color: bleuFonce }}>Ajouter un étudiant — Campus social / ESP / Claudel</h2>
          <p style={{ color: "#777", fontSize: "14px" }}>
            L'étudiant ajouté ici apparaîtra en attente de validation dans l'Espace gestion.
            Une fois validé, il n'apparaîtra pas dans le suivi des loyers.
          </p>
          <form onSubmit={ajouterEtudiantCampus} style={{
            marginBottom: "40px",
            backgroundColor: "#faf7f0",
            padding: "24px",
            borderRadius: "12px",
          }}>
            <div style={{ marginBottom: "18px" }}>
              <label style={{ fontSize: "14px", fontWeight: "700", color: "#1a1a1a", display: "block", marginBottom: "6px" }}>
                Nom <span style={{ color: "#c98a2c" }}>*</span>
              </label>
              <input type="text" name="nom" value={campusFormData.nom} onChange={handleCampusChange} required placeholder="Tine" style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #1e5fa8", backgroundColor: "#fdfcf9", color: "#1a1a1a", fontSize: "15px", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: "18px" }}>
              <label style={{ fontSize: "14px", fontWeight: "700", color: "#1a1a1a", display: "block", marginBottom: "6px" }}>
                Prénom <span style={{ color: "#c98a2c" }}>*</span>
              </label>
              <input type="text" name="prenom" value={campusFormData.prenom} onChange={handleCampusChange} required placeholder="Maurice Latyr" style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #1e5fa8", backgroundColor: "#fdfcf9", color: "#1a1a1a", fontSize: "15px", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: "18px" }}>
              <label style={{ fontSize: "14px", fontWeight: "700", color: "#1a1a1a", display: "block", marginBottom: "6px" }}>
                Téléphone <span style={{ color: "#c98a2c" }}>*</span>
              </label>
              <input type="tel" name="telephone" value={campusFormData.telephone} onChange={handleCampusChange} required placeholder="77 123 45 67" style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #1e5fa8", backgroundColor: "#fdfcf9", color: "#1a1a1a", fontSize: "15px", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: "18px" }}>
              <label style={{ fontSize: "14px", fontWeight: "700", color: "#1a1a1a", display: "block", marginBottom: "6px" }}>Filière</label>
              <input type="text" name="filiere" value={campusFormData.filiere} onChange={handleCampusChange} placeholder="Ex: Mathématiques" style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #1e5fa8", backgroundColor: "#fdfcf9", color: "#1a1a1a", fontSize: "15px", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: "18px" }}>
              <label style={{ fontSize: "14px", fontWeight: "700", color: "#1a1a1a", display: "block", marginBottom: "6px" }}>Niveau</label>
              <input type="text" name="niveau" value={campusFormData.niveau} onChange={handleCampusChange} placeholder="Ex: Licence 2" style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #1e5fa8", backgroundColor: "#fdfcf9", color: "#1a1a1a", fontSize: "15px", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: "18px" }}>
              <label style={{ fontSize: "14px", fontWeight: "700", color: "#1a1a1a", display: "block", marginBottom: "6px" }}>
                Lieu <span style={{ color: "#c98a2c" }}>*</span>
              </label>
              <select name="lieuChambre" value={campusFormData.lieuChambre} onChange={handleCampusChange} style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #1e5fa8", backgroundColor: "#fdfcf9", color: "#1a1a1a", fontSize: "15px", boxSizing: "border-box" }}>
                {LIEUX_CHAMBRE.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: "22px" }}>
              <label style={{ fontSize: "14px", fontWeight: "700", color: "#1a1a1a", display: "block", marginBottom: "6px" }}>
                Numéro de chambre <span style={{ color: "#c98a2c" }}>*</span>
              </label>
              <input type="text" name="numeroChambre" value={campusFormData.numeroChambre} onChange={handleCampusChange} required placeholder="Ex: 12" style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #1e5fa8", backgroundColor: "#fdfcf9", color: "#1a1a1a", fontSize: "15px", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginBottom: "18px" }}>
              <label style={{ fontSize: "14px", fontWeight: "700", color: "#1a1a1a", display: "block", marginBottom: "6px" }}>
                Certificat d'inscription (PDF ou image)
              </label>
              <input
                type="file"
                name="certificat"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setCampusCertificatFile(e.target.files[0])}
                style={{ fontSize: "13px" }}
              />
              {campusCertificatFile && (
                <p style={{ fontSize: "12px", color: "green", marginTop: "6px" }}>
                  Fichier sélectionné : {campusCertificatFile.name}
                </p>
              )}
            </div>
            <button
              type="submit"
              style={{
                width: "100%",
                backgroundColor: bleuFonce,
                color: "white",
                border: "none",
                padding: "12px",
                borderRadius: "10px",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "15px",
              }}
            >
              Ajouter l'étudiant
            </button>
          </form>

          <h2 style={{ color: bleuFonce }}>Étudiants enregistrés</h2>
          {demandes.filter((d) => d.lieuChambre).length === 0 ? (
            <p>Aucun étudiant enregistré pour le moment.</p>
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
              <div
                key={lieu}
                style={{
                  marginBottom: "18px",
                  border: `1px solid ${bleuMoyen}`,
                  borderRadius: "8px",
                  padding: "14px 18px"
                }}
              >
                <h3 style={{ color: bleuMoyen, marginTop: 0, marginBottom: "8px" }}>{lieu}</h3>
                <ul style={{ margin: 0, paddingLeft: "20px" }}>
                  {etudiants.map((e) => (
                    <li key={e.id} style={{ marginBottom: "4px" }}>
                      Chambre {e.numeroChambre || "?"} — {e.nom} {e.prenom} — {e.telephone} —{" "}
                      <span style={{ fontWeight: "bold", color: couleurStatut(e.statut) }}>{e.statut}</span>
                      {e.certificat && (
                        <>
                          {" — "}
                          <button
                            onClick={() => voirCertificat(e.certificat)}
                            style={{ background: "none", border: "none", color: "#1e5fa8", textDecoration: "underline", cursor: "pointer", padding: 0, font: "inherit" }}
                          >
                            Voir le certificat
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default App; 
