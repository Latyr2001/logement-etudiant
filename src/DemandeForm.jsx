import { useState } from "react";
import { supabase } from "./supabaseClient";

function DemandeForm({ onSubmitDemande }) {
  const [formData, setFormData] = useState({
    nom: "",
    prenom: "",
    filiere: "",
    niveau: "",
    telephone: "",
    email: "",
    typeLogement: "chambre partagée",
    quartier: "Mermoz",
    autreQuartier: "",
    numeroCarteEtudiant: "",
    message: "",
  });

  const [certificatFile, setCertificatFile] = useState(null);
  const [envoye, setEnvoye] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

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
      };

      const { error } = await supabase
        .from("demandes")
        .insert([nouvelleDemande]);

      if (error) throw error;

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

  const styleLabel = { fontSize: "15px", fontWeight: "700", color: "#1a1a1a", display: "block", marginBottom: "8px" };
  const styleAsterisque = { color: "#c98a2c" };
  const styleChamp = {
    width: "100%",
    padding: "14px 16px",
    fontSize: "16px",
    borderRadius: "10px",
    border: "1px solid #e2ddd0",
    backgroundColor: "#fdfcf9",
    boxSizing: "border-box",
    fontFamily: "inherit",
    color: "#1a1a1a",
  };

  if (envoye) {
    return (
      <div style={{ padding: "30px", textAlign: "center", fontFamily: "'Segoe UI', Arial, sans-serif", backgroundColor: "#faf7f0" }}>
        <h2 style={{ color: bleuFonce, fontSize: "20px" }}>Merci {formData.prenom} !</h2>
        <p style={{ fontSize: "14px", color: "#555" }}>Votre demande de logement a bien été enregistrée.</p>
      </div>
    );
  }

  return (
    <div style={{
      padding: "28px 24px",
      fontFamily: "'Segoe UI', Arial, sans-serif",
      maxWidth: "480px",
      margin: "0 auto",
      backgroundColor: "#faf7f0",
    }}>
      {erreur && <p style={{ color: "red", fontSize: "13px" }}>{erreur}</p>}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "22px" }}>
          <label style={styleLabel}>Nom <span style={styleAsterisque}>*</span></label>
          <input type="text" name="nom" value={formData.nom} onChange={handleChange} required placeholder="Diallo" style={styleChamp} />
        </div>

        <div style={{ marginBottom: "22px" }}>
          <label style={styleLabel}>Prénom <span style={styleAsterisque}>*</span></label>
          <input type="text" name="prenom" value={formData.prenom} onChange={handleChange} required placeholder="Aminata" style={styleChamp} />
        </div>

        <div style={{ marginBottom: "22px" }}>
          <label style={styleLabel}>Filière <span style={styleAsterisque}>*</span></label>
          <input type="text" name="filiere" value={formData.filiere} onChange={handleChange} required placeholder="Ex: Mathématiques" style={styleChamp} />
        </div>

        <div style={{ marginBottom: "22px" }}>
          <label style={styleLabel}>Numéro de carte étudiant <span style={styleAsterisque}>*</span></label>
          <input type="text" name="numeroCarteEtudiant" value={formData.numeroCarteEtudiant} onChange={handleChange} required placeholder="ETU-2026-00417" style={styleChamp} />
        </div>

        <div style={{ marginBottom: "22px" }}>
          <label style={styleLabel}>Niveau d'étude <span style={styleAsterisque}>*</span></label>
          <input type="text" name="niveau" value={formData.niveau} onChange={handleChange} placeholder="Ex: Licence 2" style={styleChamp} />
        </div>

        <div style={{ marginBottom: "22px" }}>
          <label style={styleLabel}>Téléphone <span style={styleAsterisque}>*</span></label>
          <input type="tel" name="telephone" value={formData.telephone} onChange={handleChange} required placeholder="77 123 45 67" style={styleChamp} />
        </div>

        <div style={{ marginBottom: "22px" }}>
          <label style={styleLabel}>Email</label>
          <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="exemple@gmail.com" style={styleChamp} />
        </div>

        <div style={{ marginBottom: "22px" }}>
          <label style={styleLabel}>Type de logement souhaité <span style={styleAsterisque}>*</span></label>
          <select name="typeLogement" value={formData.typeLogement} onChange={handleChange} style={styleChamp}>
            <option value="chambre partagée">Chambre partagée</option>
          </select>
        </div>

        <div style={{ marginBottom: "22px" }}>
          <label style={styleLabel}>Quartier / Résidence souhaité <span style={styleAsterisque}>*</span></label>
          <select name="quartier" value={formData.quartier} onChange={handleChange} style={styleChamp}>
            <option value="Mermoz">Mermoz</option>
            <option value="Fass">Fass</option>
            <option value="Médina">Médina</option>
            <option value="Autre">Autre (à préciser)</option>
          </select>
        </div>

        {formData.quartier === "Autre" && (
          <div style={{ marginBottom: "22px" }}>
            <label style={styleLabel}>Précisez le quartier</label>
            <input
              type="text"
              name="autreQuartier"
              value={formData.autreQuartier}
              onChange={handleChange}
              placeholder="Ex: Grand Yoff"
              style={styleChamp}
            />
          </div>
        )}

        <div style={{ marginBottom: "22px" }}>
          <label style={styleLabel}>Certificat d'inscription (PDF ou image) <span style={styleAsterisque}>*</span></label>
          <input type="file" name="certificat" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} required style={{ fontSize: "13px" }} />
          {certificatFile && <p style={{ fontSize: "12px", color: "green", marginTop: "6px" }}>Fichier sélectionné : {certificatFile.name}</p>}
        </div>

        <div style={{ marginBottom: "26px" }}>
          <label style={styleLabel}>Message (optionnel)</label>
          <textarea name="message" value={formData.message} onChange={handleChange} rows="3" placeholder="Un mot pour l'amicale..." style={{ ...styleChamp, resize: "vertical" }} />
        </div>

        <button
          type="submit"
          disabled={envoiEnCours}
          style={{
            width: "100%",
            backgroundColor: bleuFonce,
            color: "white",
            border: "none",
            padding: "14px",
            borderRadius: "10px",
            fontSize: "15px",
            fontWeight: "bold",
            cursor: envoiEnCours ? "default" : "pointer",
            opacity: envoiEnCours ? 0.7 : 1,
          }}
        >
          {envoiEnCours ? "Envoi en cours..." : "Envoyer la demande"}
        </button>
      </form>
    </div>
  );
}

export default DemandeForm; 
