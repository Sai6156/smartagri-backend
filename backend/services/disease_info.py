"""
Static knowledge base: disease remedies, fertilizer suggestions,
severity ratings for all 38 PlantVillage classes.
"""

DISEASE_INFO: dict = {
    # ── Apple ───────────────────────────────────────────────────────────
    "Apple___Apple_scab": {
        "display_name": "Apple Scab",
        "crop": "Apple",
        "severity": "Medium",
        "description": "Fungal disease caused by Venturia inaequalis. Causes dark scabby lesions on leaves and fruit.",
        "remedies": [
            "Apply fungicides containing captan or mancozeb at bud break.",
            "Remove and destroy infected leaves and fallen fruit.",
            "Prune trees to improve air circulation.",
        ],
        "fertilizers": ["Balanced NPK (10-10-10)", "Potassium-rich fertilizer to boost immunity"],
        "prevention": "Plant resistant apple varieties. Avoid overhead irrigation.",
    },
    "Apple___Black_rot": {
        "display_name": "Apple Black Rot",
        "crop": "Apple",
        "severity": "High",
        "description": "Caused by Botryosphaeria obtusa. Creates dark rotting lesions on fruit and leaves.",
        "remedies": [
            "Apply copper-based fungicides every 7-10 days.",
            "Remove infected branches 10-15cm below visible infection.",
            "Destroy all mummified fruit.",
        ],
        "fertilizers": ["Calcium nitrate to strengthen cell walls", "NPK 20-10-10"],
        "prevention": "Maintain tree vigor with proper fertilization. Avoid wounding bark.",
    },
    "Apple___Cedar_apple_rust": {
        "display_name": "Cedar Apple Rust",
        "crop": "Apple",
        "severity": "Medium",
        "description": "Caused by Gymnosporangium juniperi-virginianae. Orange/yellow spots on leaves.",
        "remedies": [
            "Spray myclobutanil or propiconazole fungicide from pink stage through petal fall.",
            "Remove nearby eastern red cedar trees if possible.",
        ],
        "fertilizers": ["Balanced NPK", "Micronutrient foliar spray"],
        "prevention": "Plant rust-resistant apple varieties.",
    },
    "Apple___healthy": {
        "display_name": "Healthy Apple",
        "crop": "Apple",
        "severity": "None",
        "description": "Plant appears healthy. No disease detected.",
        "remedies": [],
        "fertilizers": ["Continue regular NPK fertilization schedule"],
        "prevention": "Maintain current practices. Monitor regularly.",
    },

    # ── Blueberry ───────────────────────────────────────────────────────
    "Blueberry___healthy": {
        "display_name": "Healthy Blueberry",
        "crop": "Blueberry",
        "severity": "None",
        "description": "Plant appears healthy.",
        "remedies": [],
        "fertilizers": ["Acid-forming fertilizer (ammonium sulfate)", "Iron chelate if yellowing occurs"],
        "prevention": "Maintain soil pH 4.5–5.5. Mulch around base.",
    },

    # ── Cherry ──────────────────────────────────────────────────────────
    "Cherry_(including_sour)___Powdery_mildew": {
        "display_name": "Cherry Powdery Mildew",
        "crop": "Cherry",
        "severity": "Medium",
        "description": "White powdery fungal coating on leaves caused by Podosphaera clandestina.",
        "remedies": [
            "Apply sulfur-based fungicide or potassium bicarbonate.",
            "Use neem oil spray every 7 days.",
            "Improve air circulation by pruning.",
        ],
        "fertilizers": ["Low-nitrogen fertilizer to reduce soft growth", "Potassium sulfate"],
        "prevention": "Avoid overhead watering. Plant in sunny, well-ventilated areas.",
    },
    "Cherry_(including_sour)___healthy": {
        "display_name": "Healthy Cherry",
        "crop": "Cherry",
        "severity": "None",
        "description": "Plant appears healthy.",
        "remedies": [],
        "fertilizers": ["NPK 10-10-10 in spring"],
        "prevention": "Regular monitoring for early signs of disease.",
    },

    # ── Corn ────────────────────────────────────────────────────────────
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot": {
        "display_name": "Corn Gray Leaf Spot",
        "crop": "Corn",
        "severity": "High",
        "description": "Caused by Cercospora zeae-maydis. Rectangular gray lesions parallel to leaf veins.",
        "remedies": [
            "Apply strobilurin or triazole fungicides at tasseling.",
            "Rotate crops — avoid corn-on-corn.",
            "Till residue to reduce overwintering fungus.",
        ],
        "fertilizers": ["High-nitrogen fertilizer (Urea 46-0-0)", "NPK 20-10-10"],
        "prevention": "Plant tolerant hybrids. Ensure proper plant spacing.",
    },
    "Corn_(maize)___Common_rust_": {
        "display_name": "Corn Common Rust",
        "crop": "Corn",
        "severity": "Medium",
        "description": "Caused by Puccinia sorghi. Reddish-brown pustules on both leaf surfaces.",
        "remedies": [
            "Apply fungicides (mancozeb, propiconazole) at early rust appearance.",
            "Scout fields weekly during growing season.",
        ],
        "fertilizers": ["Balanced NPK", "Potassium to improve disease resistance"],
        "prevention": "Plant rust-resistant corn varieties.",
    },
    "Corn_(maize)___Northern_Leaf_Blight": {
        "display_name": "Corn Northern Leaf Blight",
        "crop": "Corn",
        "severity": "High",
        "description": "Caused by Exserohilum turcicum. Long grayish-green to tan cigar-shaped lesions.",
        "remedies": [
            "Apply foliar fungicides at early disease onset.",
            "Ensure good drainage and air circulation.",
        ],
        "fertilizers": ["Nitrogen-balanced fertilizer", "Silicon foliar spray to strengthen leaves"],
        "prevention": "Use resistant hybrids. Rotate with non-host crops.",
    },
    "Corn_(maize)___healthy": {
        "display_name": "Healthy Corn",
        "crop": "Corn",
        "severity": "None",
        "description": "Plant appears healthy.",
        "remedies": [],
        "fertilizers": ["Urea top dressing at knee-high stage"],
        "prevention": "Continue scouting. Apply preventive fungicide if weather is humid.",
    },

    # ── Grape ───────────────────────────────────────────────────────────
    "Grape___Black_rot": {
        "display_name": "Grape Black Rot",
        "crop": "Grape",
        "severity": "High",
        "description": "Caused by Guignardia bidwellii. Brown lesions on leaves; shriveled black fruit.",
        "remedies": [
            "Apply mancozeb or myclobutanil from early growth through veraison.",
            "Remove and destroy infected mummified fruit.",
        ],
        "fertilizers": ["Potassium-rich fertilizer", "Balanced NPK 10-10-10"],
        "prevention": "Prune for air circulation. Avoid wetting foliage.",
    },
    "Grape___Esca_(Black_Measles)": {
        "display_name": "Grape Esca (Black Measles)",
        "crop": "Grape",
        "severity": "High",
        "description": "Complex fungal disease. Tiger-stripe pattern on leaves; internal wood discoloration.",
        "remedies": [
            "No effective chemical cure. Remove infected wood by pruning.",
            "Paint pruning wounds with wound sealant.",
            "Apply sodium arsenite where legally permitted.",
        ],
        "fertilizers": ["Balanced nutrition to maintain vine vigor"],
        "prevention": "Avoid large pruning wounds. Protect cuts with fungicidal paste.",
    },
    "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)": {
        "display_name": "Grape Leaf Blight",
        "crop": "Grape",
        "severity": "Medium",
        "description": "Caused by Pseudocercospora vitis. Angular dark spots on leaves.",
        "remedies": [
            "Apply copper-based fungicide or mancozeb.",
            "Remove heavily infected leaves.",
        ],
        "fertilizers": ["Micronutrient foliar spray", "NPK 12-6-6"],
        "prevention": "Improve canopy management. Avoid dense planting.",
    },
    "Grape___healthy": {
        "display_name": "Healthy Grape",
        "crop": "Grape",
        "severity": "None",
        "description": "Plant appears healthy.",
        "remedies": [],
        "fertilizers": ["NPK 10-10-10 pre-bloom"],
        "prevention": "Regular canopy management and scouting.",
    },

    # ── Orange ──────────────────────────────────────────────────────────
    "Orange___Haunglongbing_(Citrus_greening)": {
        "display_name": "Citrus Greening (HLB)",
        "crop": "Orange",
        "severity": "High",
        "description": "Caused by Candidatus Liberibacter. Blotchy mottling; misshapen bitter fruit. No cure.",
        "remedies": [
            "Remove and destroy infected trees immediately.",
            "Control Asian citrus psyllid vector with imidacloprid.",
            "Thermotherapy for propagation material.",
        ],
        "fertilizers": ["Micronutrient foliar spray (zinc, manganese, iron)", "Balanced NPK"],
        "prevention": "Use certified disease-free planting material. Control psyllid populations.",
    },

    # ── Peach ───────────────────────────────────────────────────────────
    "Peach___Bacterial_spot": {
        "display_name": "Peach Bacterial Spot",
        "crop": "Peach",
        "severity": "Medium",
        "description": "Caused by Xanthomonas arboricola. Water-soaked spots on leaves and fruit.",
        "remedies": [
            "Apply copper hydroxide sprays during dormant season.",
            "Apply oxytetracycline antibiotic during growing season.",
        ],
        "fertilizers": ["Avoid excess nitrogen", "Potassium and calcium supplements"],
        "prevention": "Plant resistant varieties. Avoid overhead irrigation.",
    },
    "Peach___healthy": {
        "display_name": "Healthy Peach",
        "crop": "Peach",
        "severity": "None",
        "description": "Plant appears healthy.",
        "remedies": [],
        "fertilizers": ["Balanced NPK 10-10-10 in early spring"],
        "prevention": "Regular scouting. Maintain proper tree spacing.",
    },

    # ── Pepper ──────────────────────────────────────────────────────────
    "Pepper,_bell___Bacterial_spot": {
        "display_name": "Pepper Bacterial Spot",
        "crop": "Bell Pepper",
        "severity": "Medium",
        "description": "Caused by Xanthomonas euvesicatoria. Water-soaked lesions turning brown.",
        "remedies": [
            "Spray copper-based bactericide every 5-7 days.",
            "Remove infected plant debris.",
        ],
        "fertilizers": ["Low-nitrogen, high-potassium fertilizer", "Calcium nitrate"],
        "prevention": "Use certified disease-free seeds. Rotate crops.",
    },
    "Pepper,_bell___healthy": {
        "display_name": "Healthy Bell Pepper",
        "crop": "Bell Pepper",
        "severity": "None",
        "description": "Plant appears healthy.",
        "remedies": [],
        "fertilizers": ["NPK 5-10-10 at transplanting", "Calcium-magnesium supplement"],
        "prevention": "Monitor regularly. Avoid waterlogged soil.",
    },

    # ── Potato ──────────────────────────────────────────────────────────
    "Potato___Early_blight": {
        "display_name": "Potato Early Blight",
        "crop": "Potato",
        "severity": "Medium",
        "description": "Caused by Alternaria solani. Dark concentric ring lesions ('target spots') on leaves.",
        "remedies": [
            "Apply chlorothalonil, mancozeb, or azoxystrobin fungicide.",
            "Remove and destroy infected leaves.",
            "Maintain adequate plant nutrition.",
        ],
        "fertilizers": ["High-potassium fertilizer", "NPK 10-20-20"],
        "prevention": "Rotate crops every 2-3 years. Use certified seed potatoes.",
    },
    "Potato___Late_blight": {
        "display_name": "Potato Late Blight",
        "crop": "Potato",
        "severity": "High",
        "description": "Caused by Phytophthora infestans. Rapid water-soaked lesions; white mold underside. Famous for Irish famine.",
        "remedies": [
            "Apply metalaxyl + mancozeb (Ridomil Gold) immediately.",
            "Destroy infected plants — do NOT compost.",
            "Harvest tubers early if infection is severe.",
        ],
        "fertilizers": ["Avoid excess nitrogen", "Potassium and phosphorus supplements"],
        "prevention": "Use blight-resistant varieties. Avoid wet foliage. Monitor daily in humid weather.",
    },
    "Potato___healthy": {
        "display_name": "Healthy Potato",
        "crop": "Potato",
        "severity": "None",
        "description": "Plant appears healthy.",
        "remedies": [],
        "fertilizers": ["NPK 12-24-12 at planting", "Potassium sulfate top dressing"],
        "prevention": "Scout regularly. Ensure well-drained soil.",
    },

    # ── Raspberry ───────────────────────────────────────────────────────
    "Raspberry___healthy": {
        "display_name": "Healthy Raspberry",
        "crop": "Raspberry",
        "severity": "None",
        "description": "Plant appears healthy.",
        "remedies": [],
        "fertilizers": ["Balanced NPK 10-10-10 in spring"],
        "prevention": "Prune old canes. Maintain good air circulation.",
    },

    # ── Soybean ─────────────────────────────────────────────────────────
    "Soybean___healthy": {
        "display_name": "Healthy Soybean",
        "crop": "Soybean",
        "severity": "None",
        "description": "Plant appears healthy.",
        "remedies": [],
        "fertilizers": ["Inoculant (Bradyrhizobium) at planting", "Phosphorus and potassium"],
        "prevention": "Rotate with non-legume crops.",
    },

    # ── Squash ──────────────────────────────────────────────────────────
    "Squash___Powdery_mildew": {
        "display_name": "Squash Powdery Mildew",
        "crop": "Squash",
        "severity": "Medium",
        "description": "White powdery spots on leaves caused by Podosphaera xanthii.",
        "remedies": [
            "Apply potassium bicarbonate, sulfur, or neem oil.",
            "Remove heavily infected leaves.",
        ],
        "fertilizers": ["Avoid high-nitrogen fertilizers", "Potassium-rich fertilizer"],
        "prevention": "Provide good air circulation. Water at base, not on leaves.",
    },

    # ── Strawberry ──────────────────────────────────────────────────────
    "Strawberry___Leaf_scorch": {
        "display_name": "Strawberry Leaf Scorch",
        "crop": "Strawberry",
        "severity": "Medium",
        "description": "Caused by Diplocarpon earlianum. Small dark purple to red spots on leaves.",
        "remedies": [
            "Apply captan or myclobutanil fungicide.",
            "Remove infected leaves before winter.",
        ],
        "fertilizers": ["Balanced NPK 10-10-10", "Micronutrient foliar spray"],
        "prevention": "Plant resistant varieties. Use raised beds for drainage.",
    },
    "Strawberry___healthy": {
        "display_name": "Healthy Strawberry",
        "crop": "Strawberry",
        "severity": "None",
        "description": "Plant appears healthy.",
        "remedies": [],
        "fertilizers": ["NPK 10-10-10 after renovation"],
        "prevention": "Renovate beds annually. Control runners.",
    },

    # ── Tomato ──────────────────────────────────────────────────────────
    "Tomato___Bacterial_spot": {
        "display_name": "Tomato Bacterial Spot",
        "crop": "Tomato",
        "severity": "Medium",
        "description": "Caused by Xanthomonas vesicatoria. Small water-soaked spots with yellow halos.",
        "remedies": [
            "Spray copper hydroxide + mancozeb mixture.",
            "Remove and destroy infected plant parts.",
        ],
        "fertilizers": ["Calcium nitrate to reduce susceptibility", "Low-nitrogen, high-potassium"],
        "prevention": "Use disease-free seeds. Avoid splashing water on leaves.",
    },
    "Tomato___Early_blight": {
        "display_name": "Tomato Early Blight",
        "crop": "Tomato",
        "severity": "Medium",
        "description": "Caused by Alternaria solani. Concentric ring target spots, yellow halo around lesions.",
        "remedies": [
            "Apply chlorothalonil or mancozeb every 7-10 days.",
            "Remove lower infected leaves.",
            "Mulch around plants to reduce soil splash.",
        ],
        "fertilizers": ["Balanced NPK", "Calcium supplement"],
        "prevention": "Stake plants for airflow. Practice 3-year crop rotation.",
    },
    "Tomato___Late_blight": {
        "display_name": "Tomato Late Blight",
        "crop": "Tomato",
        "severity": "High",
        "description": "Caused by Phytophthora infestans. Greasy water-soaked patches; white fuzzy spores.",
        "remedies": [
            "Apply metalaxyl or cymoxanil-based fungicide immediately.",
            "Remove infected plants — burn or bag, do NOT compost.",
            "Avoid overhead irrigation.",
        ],
        "fertilizers": ["Reduce nitrogen", "High potassium (0-0-50) to boost immunity"],
        "prevention": "Use blight-resistant varieties. Monitor weather — risk rises in cool, wet conditions.",
    },
    "Tomato___Leaf_Mold": {
        "display_name": "Tomato Leaf Mold",
        "crop": "Tomato",
        "severity": "Medium",
        "description": "Caused by Passalora fulva. Pale green/yellow spots on upper leaf surface; olive-green mold below.",
        "remedies": [
            "Apply chlorothalonil or copper fungicide.",
            "Increase ventilation in greenhouse settings.",
        ],
        "fertilizers": ["Balanced NPK", "Potassium foliar spray"],
        "prevention": "Keep humidity below 85%. Space plants widely.",
    },
    "Tomato___Septoria_leaf_spot": {
        "display_name": "Tomato Septoria Leaf Spot",
        "crop": "Tomato",
        "severity": "Medium",
        "description": "Caused by Septoria lycopersici. Small circular spots with dark borders and light centers.",
        "remedies": [
            "Apply mancozeb, chlorothalonil, or copper fungicide.",
            "Remove affected lower leaves.",
        ],
        "fertilizers": ["Balanced NPK 10-10-10", "Calcium nitrate"],
        "prevention": "Mulch to prevent soil splash. Rotate crops every 3 years.",
    },
    "Tomato___Spider_mites Two-spotted_spider_mite": {
        "display_name": "Tomato Spider Mites",
        "crop": "Tomato",
        "severity": "Medium",
        "description": "Infestation by Tetranychus urticae. Bronze stippling on leaves; fine webbing.",
        "remedies": [
            "Apply miticide (abamectin or bifenazate).",
            "Spray insecticidal soap or neem oil.",
            "Release predatory mites (Phytoseiulus persimilis) for biological control.",
        ],
        "fertilizers": ["Avoid excess nitrogen (attracts mites)", "Silica supplement to strengthen cell walls"],
        "prevention": "Maintain adequate moisture. Avoid dusty conditions.",
    },
    "Tomato___Target_Spot": {
        "display_name": "Tomato Target Spot",
        "crop": "Tomato",
        "severity": "Medium",
        "description": "Caused by Corynespora cassiicola. Concentric ring spots on leaves and fruit.",
        "remedies": [
            "Apply azoxystrobin or difenoconazole fungicide.",
            "Remove crop debris after harvest.",
        ],
        "fertilizers": ["Balanced NPK", "Potassium sulfate"],
        "prevention": "Avoid dense planting. Ensure good drainage.",
    },
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus": {
        "display_name": "Tomato Yellow Leaf Curl Virus",
        "crop": "Tomato",
        "severity": "High",
        "description": "Transmitted by whiteflies (Bemisia tabaci). Yellowing, curling, and stunted growth.",
        "remedies": [
            "No cure — remove and destroy infected plants.",
            "Apply imidacloprid or thiamethoxam to control whitefly vector.",
            "Use yellow sticky traps.",
        ],
        "fertilizers": ["Balanced nutrition to support remaining healthy plants"],
        "prevention": "Use virus-resistant tomato varieties. Install insect-proof nets.",
    },
    "Tomato___Tomato_mosaic_virus": {
        "display_name": "Tomato Mosaic Virus",
        "crop": "Tomato",
        "severity": "High",
        "description": "Mosaic pattern of light and dark green. Spread by contact and aphids.",
        "remedies": [
            "No cure. Remove and bag infected plants.",
            "Disinfect tools with bleach solution.",
            "Control aphid vectors with neem oil or insecticidal soap.",
        ],
        "fertilizers": ["Standard fertilization for healthy uninfected plants"],
        "prevention": "Wash hands before handling plants. Use resistant varieties.",
    },
    "Tomato___healthy": {
        "display_name": "Healthy Tomato",
        "crop": "Tomato",
        "severity": "None",
        "description": "Plant appears healthy. No disease detected.",
        "remedies": [],
        "fertilizers": ["NPK 6-24-24 at transplanting", "Calcium nitrate weekly during fruiting"],
        "prevention": "Monitor regularly. Stake for airflow. Water at base.",
    },
}


def get_disease_info(class_name: str) -> dict:
    """Return disease info dict for a given class name. Returns a default if not found."""
    return DISEASE_INFO.get(class_name, {
        "display_name": class_name.replace("_", " "),
        "crop": class_name.split("___")[0] if "___" in class_name else "Unknown",
        "severity": "Unknown",
        "description": "No detailed information available for this class.",
        "remedies": ["Consult a local agricultural extension officer."],
        "fertilizers": ["Balanced NPK fertilizer"],
        "prevention": "Monitor crop regularly and consult local experts.",
    })
