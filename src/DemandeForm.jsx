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

  if (envoye) {
    return (
      <div style={{ padding: "20px" }}>
        <h2>Merci {formData.prenom} !</h2>
        <p>Votre demande de logement a bien été enregistrée.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", fontFamily: "Arial", maxWidth: "500px" }}>
      <h2>Formulaire de demande de logement</h2>
      {erreur && <p style={{ color: "red" }}>{erreur}</p>}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "10px" }}>
          <label>Nom : </label><br />
          <input type="text" name="nom" value={formData.nom} onChange={handleChange} required style={{ width: "100%" }} />
        </div>

        <div style={{ marginBottom: "10px" }}>
          <label>Prénom : </label><br />
          <input type="text" name="prenom" value={formData.prenom} onChange={handleChange} required style={{ width: "100%" }} />
        </div>

        <div style={{ marginBottom: "10px" }}>
          <label>Filière : </label><br />
          <input type="text" name="filiere" value={formData.filiere} onChange={handleChange} required style={{ width: "100%" }} />
        </div>

        <div style={{ marginBottom: "10px" }}>
          <label>Numéro de carte étudiant : </label><br />
          <input type="text" name="numeroCarteEtudiant" value={formData.numeroCarteEtudiant} onChange={handleChange} required style={{ width: "100%" }} />
        </div>

        <div style={{ marginBottom: "10px" }}>
          <label>Niveau d'étude : </label><br />
          <input type="text" name="niveau" value={formData.niveau} onChange={handleChange} placeholder="Ex: Licence 2" style={{ width: "100%" }} />
        </div>

        <div style={{ marginBottom: "10px" }}>
          <label>Téléphone : </label><br />
          <input type="tel" name="telephone" value={formData.telephone} onChange={handleChange} required style={{ width: "100%" }} />
        </div>

        <div style={{ marginBottom: "10px" }}>
          <label>Email : </label><br />
          <input type="email" name="email" value={formData.email} onChange={handleChange} style={{ width: "100%" }} />
        </div>

        <div style={{ marginBottom: "10px" }}>
          <label>Type de logement souhaité : </label><br />
          <select name="typeLogement" value={formData.typeLogement} onChange={handleChange} style={{ width: "100%" }}>
            <option value="chambre partagée">Chambre partagée</option>
          </select>
        </div>

        <div style={{ marginBottom: "10px" }}>
          <label>Quartier / Résidence souhaité : </label><br />
          <select name="quartier" value={formData.quartier} onChange={handleChange} style={{ width: "100%" }}>
            <option value="Mermoz">Mermoz</option>
            <option value="Fass">Fass</option>
            <option value="Médina">Médina</option>
            <option value="Autre">Autre (à préciser)</option>
          </select>
        </div>

        {formData.quartier === "Autre" && (
          <div style={{ marginBottom: "10px" }}>
            <label>Précisez le quartier : </label><br />
            <input
              type="text"
              name="autreQuartier"
              value={formData.autreQuartier}
              onChange={handleChange}
              placeholder="Ex: Grand Yoff"
              style={{ width: "100%" }}
            />
          </div>
        )}

        <div style={{ marginBottom: "10px" }}>
          <label>Certificat d'inscription (PDF ou image) : </label><br />
          <input type="file" name="certificat" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} required />
          {certificatFile && <p style={{ fontSize: "14px", color: "green" }}>Fichier sélectionné : {certificatFile.name}</p>}
        </div>

        <div style={{ marginBottom: "10px" }}>
          <label>Message (optionnel) : </label><br />
          <textarea name="message" value={formData.message} onChange={handleChange} rows="3" style={{ width: "100%" }} />
        </div>

        <button type="submit" disabled={envoiEnCours}>
          {envoiEnCours ? "Envoi en cours..." : "Envoyer la demande"}
        </button>
      </form>
    </div>
  );
}

export default DemandeForm; 
