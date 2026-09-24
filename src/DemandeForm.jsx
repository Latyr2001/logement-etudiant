import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import qrWave from "./qr-wave.png";

const NUMERO_WAVE = "76 682 54 10";

function DemandeForm({ onSubmitDemande, userId }) {
  const [appartementsDisponibles, setAppartementsDisponibles] = useState([]);

  const [formData, setFormData] = useState({
    nom: "",
    prenom: "",
    filiere: "",
    niveau: "",
    telephone: "",
    email: "",
    typeLogement: "chambre partagée",
    quartier: "",
    autreQuartier: "",
    numeroCarteEtudiant: "",
    message: "",
  });

  const [certificatFile, setCertificatFile] = useState(null);
  const [envoye, setEnvoye] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [numeroCopie, setNumeroCopie] = useState(false);

  const copierNumero = async () => {
    try {
      await navigator.clipboard.writeText(NUMERO_WAVE.replace(/\s/g, ""));
      setNumeroCopie(true);
      setTimeout(() => setNumeroCopie(false), 2000);
    } catch {}
  };

  useEffect(() => {
    const chargerAppartements = async () => {
      const { data, error } = await supabase
        .from("appartements")
        .select("nom")
        .order("nom", { ascending: true });
      if (!error && data) {
        const noms = data.map((a) => a.nom);
        setAppartementsDisponibles(noms);
        setFormData((prev) => ({
          ...prev,
          quartier: prev.quartier || noms[0] || "Autre",
        }));
      }
    };
    chargerAppartements();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    setCertificatFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setEnvoiEnCours(true);
    setErreur("");

    let certificatUrl = "";

    try {
      if (certificatFile) {
        const nomFichier = `${Date.now()}_${certificatFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("certificats")
          .upload(nomFichier, certificatFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("certificats")
          .getPublicUrl(nomFichier);

        certificatUrl = urlData.publicUrl;
      }

      const nouvelleDemande = {
        ...formData,
        certificat: certificatUrl,
        statut: "en attente",
        user_id: userId,
      };

      const { error } = await supabase
        .from("demandes")
        .insert([nouvelleDemande]);

      if (error) {
        if (error.code === "23505") {
          setErreur("Vous avez déjà envoyé une demande pour cet appartement avec ce numéro de carte étudiant.");
          setEnvoiEnCours(false);
          return;
        }
        throw error;
      }

      onSubmitDemande({ ...nouvelleDemande, id: Date.now() });
      setEnvoye(true);
    } catch (err) {
      console.error(err);
      setErreur("Une erreur est survenue. Réessaie.");
    } finally {
      setEnvoiEnCours(false);
    }
  };

  const bleuFonce = "#0d3b66";
  const bleuMoyen = "#1e5fa8";
  const bleuClair = "#eaf1fb";

  const styleLabel = {
    fontSize: "13px",
    fontWeight: "700",
    color: bleuFonce,
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginBottom: "6px",
  };
  const styleAsterisque = { color: "#e0574c" };
  const styleChampWrap = { position: "relative" };
  const styleIconeChamp = {
    position: "absolute",
    left: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    fontSize: "15px",
    pointerEvents: "none",
  };
  const styleChamp = {
    width: "100%",
    padding: "11px 12px 11px 36px",
    fontSize: "14px",
    borderRadius: "10px",
    border: `1.5px solid ${bleuMoyen}`,
    backgroundColor: "white",
    boxSizing: "border-box",
    fontFamily: "inherit",
    color: "#1a1a1a",
  };

  if (envoye) {
    return (
      <div style={{ padding: "30px", textAlign: "center", fontFamily: "'Segoe UI', Arial, sans-serif" }}>
        <h2 style={{ color: bleuFonce, fontSize: "20px" }}>Merci {formData.prenom} !</h2>
        <p style={{ fontSize: "14px", color: "#555" }}>Votre demande de logement a bien été enregistrée.</p>

        <div style={{
          backgroundColor: "#f0fbff",
          border: "2px solid #1dc8f2",
          borderRadius: "14px",
          padding: "18px",
          textAlign: "center",
          marginTop: "22px",
        }}>
          <p style={{ margin: 0, fontWeight: "700", color: bleuFonce, fontSize: "15px" }}>
            💙 Payer votre loyer ou votre caution par Wave
          </p>

          <p style={{ margin: "14px 0 2px", fontSize: "13px", color: "#555" }}>
            Envoyez le montant au numéro Wave :
          </p>
          <p style={{ margin: 0, fontSize: "30px", fontWeight: "800", color: bleuFonce, letterSpacing: "1px" }}>
            {NUMERO_WAVE}
          </p>
          <button
            type="button"
            onClick={copierNumero}
            style={{
              marginTop: "10px",
              padding: "8px 18px",
              borderRadius: "20px",
              border: "none",
              background: "linear-gradient(135deg, #29c5e8, #1a8fd1)",
              color: "white",
              fontWeight: "bold",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            {numeroCopie ? "✅ Copié !" : "📋 Copier le numéro"}
          </button>

          <p style={{ margin: "18px 0 8px", fontSize: "13px", color: "#555" }}>
            Ou scannez le QR code marchand :
          </p>
          <img
            src={qrWave}
            alt="QR code Wave marchand AEERN"
            style={{ width: "180px", maxWidth: "70%", background: "white", padding: "8px", borderRadius: "12px" }}
          />

          <p style={{ margin: "16px 0 0", fontSize: "12px", color: "#7a8699" }}>
            Après le paiement, gardez la capture d'écran de la confirmation Wave.
            Un problème ? Appelez le même numéro.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      fontFamily: "'Segoe UI', Arial, sans-serif",
      maxWidth: "720px",
      margin: "0 auto",
      backgroundColor: "white",
      borderRadius: "18px",
      boxShadow: "0 4px 20px rgba(13,59,102,0.08)",
      padding: "28px 26px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
        <div style={{
          width: "42px",
          height: "42px",
          borderRadius: "12px",
          background: `linear-gradient(135deg, ${bleuMoyen}, ${bleuFonce})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "20px",
          flexShrink: 0,
        }}>🏠</div>
        <p style={{ margin: 0, color: bleuFonce, fontWeight: "600", fontSize: "15px" }}>
          Bienvenue sur la plateforme officielle de demande de logement.
        </p>
      </div>

      {erreur && <p style={{ color: "red", fontSize: "13px" }}>{erreur}</p>}

      <form onSubmit={handleSubmit}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "18px 20px" }}>
          <div>
            <label style={styleLabel}>👤 Nom <span style={styleAsterisque}>*</span></label>
            <div style={styleChampWrap}>
              <span style={styleIconeChamp}>👤</span>
              <input type="text" name="nom" value={formData.nom} onChange={handleChange} required placeholder="Tine" style={styleChamp} />
            </div>
          </div>

          <div>
            <label style={styleLabel}>👤 Prénom <span style={styleAsterisque}>*</span></label>
            <div style={styleChampWrap}>
              <span style={styleIconeChamp}>👤</span>
              <input type="text" name="prenom" value={formData.prenom} onChange={handleChange} required placeholder="Maurice Latyr" style={styleChamp} />
            </div>
          </div>

          <div>
            <label style={styleLabel}>🎓 Filière <span style={styleAsterisque}>*</span></label>
            <div style={styleChampWrap}>
              <span style={styleIconeChamp}>🎓</span>
              <input type="text" name="filiere" value={formData.filiere} onChange={handleChange} required placeholder="Ex: Mathématiques" style={styleChamp} />
            </div>
          </div>

          <div>
            <label style={styleLabel}>💳 Numéro de carte étudiant <span style={styleAsterisque}>*</span></label>
            <div style={styleChampWrap}>
              <span style={styleIconeChamp}>💳</span>
              <input type="text" name="numeroCarteEtudiant" value={formData.numeroCarteEtudiant} onChange={handleChange} required placeholder="ETU-2026-00417" style={styleChamp} />
            </div>
          </div>

          <div>
            <label style={styleLabel}>📖 Niveau d'étude <span style={styleAsterisque}>*</span></label>
            <div style={styleChampWrap}>
              <span style={styleIconeChamp}>📖</span>
              <input type="text" name="niveau" value={formData.niveau} onChange={handleChange} placeholder="Ex: Licence 2" style={styleChamp} />
            </div>
          </div>

          <div>
            <label style={styleLabel}>📞 Téléphone <span style={styleAsterisque}>*</span></label>
            <div style={styleChampWrap}>
              <span style={styleIconeChamp}>📞</span>
              <input type="tel" name="telephone" value={formData.telephone} onChange={handleChange} required placeholder="77 123 45 67" style={styleChamp} />
            </div>
          </div>

          <div>
            <label style={styleLabel}>✉️ Email</label>
            <div style={styleChampWrap}>
              <span style={styleIconeChamp}>✉️</span>
              <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="exemple@gmail.com" style={styleChamp} />
            </div>
          </div>

          <div>
            <label style={styleLabel}>🏠 Type de logement souhaité <span style={styleAsterisque}>*</span></label>
            <div style={styleChampWrap}>
              <span style={styleIconeChamp}>🏠</span>
              <select name="typeLogement" value={formData.typeLogement} onChange={handleChange} style={styleChamp}>
                <option value="chambre partagée">Chambre partagée</option>
              </select>
            </div>
          </div>

          <div>
            <label style={styleLabel}>📍 Appartement souhaité <span style={styleAsterisque}>*</span></label>
            <div style={styleChampWrap}>
              <span style={styleIconeChamp}>📍</span>
              <select name="quartier" value={formData.quartier} onChange={handleChange} style={styleChamp}>
                {appartementsDisponibles.map((appt) => (
                  <option key={appt} value={appt}>{appt}</option>
                ))}
                <option value="Autre">Autre (à préciser)</option>
              </select>
            </div>
          </div>

          {formData.quartier === "Autre" && (
            <div>
              <label style={styleLabel}>📍 Précisez le quartier</label>
              <div style={styleChampWrap}>
                <span style={styleIconeChamp}>📍</span>
                <input
                  type="text"
                  name="autreQuartier"
                  value={formData.autreQuartier}
                  onChange={handleChange}
                  placeholder="Ex: Grand Yoff"
                  style={styleChamp}
                />
              </div>
            </div>
          )}

          <div>
            <label style={styleLabel}>📄 Certificat d'inscription (PDF ou image) <span style={styleAsterisque}>*</span></label>
            <label
              htmlFor="certificat-input"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "4px",
                border: `1.5px dashed ${bleuMoyen}`,
                borderRadius: "10px",
                backgroundColor: bleuClair,
                padding: "16px",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              <span style={{ fontSize: "18px" }}>☁️</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: bleuFonce }}>
                {certificatFile ? "Changer le fichier" : "Choisir un fichier"}
              </span>
              <span style={{ fontSize: "11px", color: "#7a8699" }}>
                {certificatFile ? certificatFile.name : "Aucun fichier choisi"}
              </span>
              <input
                id="certificat-input"
                type="file"
                name="certificat"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                required
                style={{ display: "none" }}
              />
            </label>
          </div>
        </div>

        <div style={{ marginTop: "18px" }}>
          <label style={styleLabel}>💬 Message (optionnel)</label>
          <textarea
            name="message"
            value={formData.message}
            onChange={handleChange}
            rows="3"
            placeholder="Un mot pour l'amicale..."
            style={{ ...styleChamp, paddingLeft: "12px", resize: "vertical" }}
          />
        </div>

        <button
          type="submit"
          disabled={envoiEnCours}
          style={{
            width: "100%",
            marginTop: "22px",
            background: `linear-gradient(135deg, ${bleuMoyen}, ${bleuFonce})`,
            color: "white",
            border: "none",
            padding: "14px",
            borderRadius: "12px",
            fontSize: "15px",
            fontWeight: "bold",
            cursor: envoiEnCours ? "default" : "pointer",
            opacity: envoiEnCours ? 0.7 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <span>➤</span> {envoiEnCours ? "Envoi en cours..." : "Envoyer la demande"}
        </button>
      </form>
    </div>
  );
}

export default DemandeForm; 
