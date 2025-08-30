# **Product Requirements Document (PRD): Ramify Pricing Simulator**

## **1\. Introduction and Goal**

### **1.1. Problem Statement**

Ramify currently prices articles primarily on a per-word (PW) basis, which incentivizes length and leads to unpredictable costs. Transitioning to strict fixed pricing risks degrading quality, as complex topics often require length that cannot be predicted in advance. Analysis shows that writers have different individual rates and varying levels of consistency (Coefficient of Variation or CV). A solution is needed that offers budget predictability while maintaining flexibility for outliers, utilizing strategies like "Cap \+ Overage" for consistent writers and Per-Word for high-variance writers, potentially augmented by quality bonuses.

### **1.2. Objective**

To develop a client-side web application that allows the Content Manager to:

1. Import and analyze historical article data, including statistical variability (CV, Percentiles).  
2. Configure individualized historical pricing rates (the **Baseline**).  
3. Simulate various pricing models, including "Mixed Scenarios" and quality bonuses (the **Simulation**).  
4. Compare the financial impact of the Simulation against the Baseline, both globally and per writer.

## **2\. Technical Requirements and Constraints**

* **Platform:** Web Application (Desktop focus).  
* **Stack:** HTML, CSS, JavaScript.  
* **Architecture:** 100% Client-Side Processing. No backend server, API, or database.  
* **Libraries:** The use of established libraries is expected for:  
  * CSV Parsing (e.g., PapaParse).  
  * Date Handling (e.g., date-fns or Moment.js, necessary for parsing DD/MM/YYYY).  
  * Data Visualization (e.g., Chart.js or ApexCharts).  
  * **Statistical calculations** (Necessary for Standard Deviation, CV, and Percentiles).  
* **Deployment:** The application must be deployable as a static site (e.g., GitHub Pages).  
* **Language and currency:** everything in French and use Euros (€)

## **3\. Data Structure and Import**

### **3.1. Input CSV Format**

The application must accept a CSV file upload with the following columns:

| Column Name | Data Type | Format/Notes |
| :---- | :---- | :---- |
| URL | String | Unique identifier. |
| Writer | String | Name of the writer. |
| Publish Date | Date | Must handle DD/MM/YYYY format. |
| Word Count | Integer | Length of the article. |

*Note: Any other columns in the input CSV must be ignored.*

### **3.2. Data Handling**

* **Parsing:** Parse the CSV into an internal JavaScript array of objects.  
* **Validation:** Handle basic errors (e.g., missing Word Count or invalid Date format).  
* **Writer Identification:** Extract the list of unique writers from the dataset upon import.

## **4\. Pricing Models (Logic Definitions)**

The application must implement the following pricing models, which can be assigned individually to any writer.

### **4.0. Global Modifier: Quality Bonus**

* **Description:** An optional percentage modifier applied after the model calculation to incentivize quality.  
* **Parameters:** Bonus Percentage (%).  
* **Formula:** Final Cost \= Model Cost \* (1 \+ (Bonus Percentage / 100))

### **4.1. Per-Word (PW)**

* **Description:** Standard volume-based pricing.  
* **Parameters:** Rate (€/word).  
* **Formula:** Model Cost \= Word Count \* Rate

### **4.2. Fixed Price (FP)**

* **Description:** Set price per article, regardless of length.  
* **Parameters:** Fixed Amount (€/article).  
* **Formula:** Model Cost \= Fixed Amount

### **4.3. Hybrid Model (HY)**

* **Description:** Base fee for research/expertise plus a reduced rate for execution starting from word 1\.  
* **Parameters:** Base Fee (€), Reduced Rate (€/word).  
* **Formula:** Model Cost \= Base Fee \+ (Word Count \* Reduced Rate)

### **4.4. Decreasing Marginal Rate (DMR)**

* **Description:** Reduces the per-word rate after a certain length threshold.  
* **Parameters:** Standard Rate (€/word), Threshold (Word Count), Lower Rate (€/word).  
* **Formula:**  
  * If Word Count \<= Threshold: Model Cost \= Word Count \* Standard Rate  
  * If Word Count \> Threshold: Model Cost \= (Threshold \* Standard Rate) \+ ((Word Count \- Threshold) \* Lower Rate)

### **4.5. Cap and Overage (C+O)**

* **Description:** A fixed price is paid up to the Cap. Words exceeding the cap are paid at the Overage Rate. Balances predictability with flexibility for outliers.  
* **Parameters:** Fixed Amount (€), Cap (Word Count), Overage Rate (€/word).  
* **Formula:**  
  * If Word Count \<= Cap: Model Cost \= Fixed Amount  
  * If Word Count \> Cap: Model Cost \= Fixed Amount \+ ((Word Count \- Cap) \* Overage Rate)

## **5\. Functional Requirements (Features)**

### **5.1. Data Import**

* **F1.1: CSV Upload:** A file input or drag-and-drop zone for CSV upload.  
* **F1.2: Feedback:** Display success/error messages after processing.

### **5.2. Configuration Panel (Mixed Scenario Setup)**

This panel allows the user to define the parameters for the **Baseline** and the **Simulation**.

* **F2.1: Dynamic Writer List:** Automatically list all unique writers from the imported CSV.  
* **F2.2: Global Defaults:** Allow setting a default model, parameters, and bonus applicable to all writers unless overridden.  
* **F2.3: Writer Overrides (Individualization):** Allow the user to override the global default for any individual writer in either scenario.  
* **F2.4: Baseline Configuration:** Typically represents historical cost (e.g., individualized PW rates).  
* **F2.5: Simulation Configuration:** The user defines the proposed pricing structure (e.g., a mix of C+O and PW).  
* **F2.6: Dynamic Parameter Inputs:** When a user selects a model (PW, FP, HY, DMR, C+O) via a dropdown, the UI must dynamically display the corresponding parameter input fields.  
* **F2.7: Bonus Input:** An input field for Bonus Percentage (See 4.0) must be available for every configuration (Global Defaults and Writer Overrides) in both Baseline and Simulation scenarios.

*Conceptual Configuration UI:*

| Writer | Baseline Configuration | Simulated Configuration |
| :---- | :---- | :---- |
| *Global Default* | Model: \[PW\] Rate: \[0.13\] Bonus: \[0\]% | Model: \[PW\] Rate: \[0.13\] Bonus: \[0\]% |
| Elodie A. R. | \[ \] Use Default | \[x\] Override: \[C+O\] Fixed: \[773\] Cap: \[7063\] Overage: \[0.13\] Bonus: \[2\]% |
| Maxime | \[ \] Use Default | \[ \] Use Default (Stays on PW) |

### **5.3. Calculation Engine**

The engine must run automatically whenever data is imported or configurations change.

* **F3.1: Cost Calculation:** Iterate through all articles. For each article, retrieve the specific model/parameters assigned to the article's writer, calculate the Model Cost, and then apply the Bonus Percentage (if any) to get the Final Cost. Repeat for Baseline and Simulation.  
* **F3.2: Effective Rate Calculation:** Effective Rate \= Total Final Cost / Total Word Count.  
* **F3.3: Breakeven Point Calculation:** The word count where the Simulation cost equals the Baseline cost for a specific writer. (Requires implementation based on the specific models being compared).  
* **F3.4: Statistical Analysis:** Calculate key statistics for Word Count, globally and per writer, to inform model selection based on variability.  
  * **Mean, Median (P50).**  
  * **Standard Deviation (StdDev).**  
  * **Coefficient of Variation (CV):** CV \= StdDev / Mean. (Used to identify high/low variance writers. Lower CV means more consistency).  
  * **Percentiles P25 and P75.** (P75 is often used to set Caps in the C+O model).

### **5.4. Analytics and Comparison Dashboard**

This is the main view for presenting results, comparing Baseline vs. Simulation.

* **F4.1: Global Metrics (KPIs):**  
  * Total Articles, Average Word Count, Median Word Count, CV (Global).  
  * Total Cost (Baseline vs. Simulation).  
  * Average Cost per Article (Baseline vs. Simulation).  
  * **Total Savings/Increase:** (Simulation Cost \- Baseline Cost), displayed in currency (€) and percentage (%). Highlight this metric.  
* **F4.2: Per-Writer Breakdown Table:** A detailed comparison table. Sortable by any column.  
  * **Columns (Statistics):** Writer Name, Article Count, Avg Word Count, **CV (Word Count)**, **P25**, **P75**.  
  * **Columns (Financial):** Total Cost (Baseline), Total Cost (Simulation), Cost Difference (%), Effective Rate (Baseline), Effective Rate (Simulation), Breakeven Point (if applicable).  
* **F4.3: Visualizations:**  
  * **V1: Word Count Trend Over Time:** A line chart showing the evolution of the average word count over time (grouped by month). Must allow toggling lines for the global trend and individual writers.  
  * **V2: Cost Comparison by Writer:** A grouped bar chart comparing the total cost (Baseline vs. Simulated) for each writer.

### **5.5. Data Grid**

* **F5.1: Detailed Article View:** A sortable/searchable table displaying the raw imported data.  
* **F5.2: Calculated Columns:** Include columns for the calculated Baseline Cost, Simulation Cost, and Difference (€) for each individual article.

## **6\. UI/UX and Workflow**

### **6.1. Layout**

A clean dashboard layout. A sidebar for the Configuration Panel (5.2) and CSV Import (5.1). The main content area for the Dashboard (5.4) and the Data Grid (5.5). Use a white \+ “sky” color palette, minimalist with thoughtful details.

### **6.2. Workflow**

1. **Import:** User imports CSV. App parses data and calculates statistics (CV, P75, etc.).  
2. **Analyze Statistics:** User reviews the CV and P75 metrics in the Dashboard (F4.2) to understand writer variability and potential caps.  
3. **Configure Baseline:** User defines historical individualized pricing.  
4. **Configure Simulation:** User defines the mixed scenario (e.g., applying C+O to low-CV writers using P75 as the Cap, keeping high-CV writers on PW, and adding quality bonuses).  
5. **Analyze Impact:** The Dashboard updates in real-time. The user reviews financial impacts and iterates.

## **7\. Internal Data Structure (Guidance for LLM)**

The application should maintain internal state similar to these examples.

### **7.1. Article Data Object**

JavaScript

\[  
  {  
    "url": "https://www.ramify.fr/...",  
    "writer": "Elodie A. R.",  
    "publishDate": DateObject,  
    "wordCount": 8000,  
    "baselineCost": 1040.00, // Calculated (e.g. 8000 \* 0.13)  
    // Simulation C+O: Fixed 773, Cap 7063, Overage 0.13, Bonus 2%  
    // Model Cost \= 773 \+ ((8000 \- 7063\) \* 0.13) \= 894.81  
    "simulationCost": 912.71 // 894.81 \* 1.02  
  }  
\]

### **7.2. Configuration State Object (Example)**

JavaScript

{  
  "globalDefaults": {  
    "baseline": { "model": "PW", "params": { "Rate": 0.13 }, "bonusPercent": 0 },  
    "simulation": { "model": "PW", "params": { "Rate": 0.13 }, "bonusPercent": 0 }  
  },  
  "writerOverrides": {  
    "Elodie A. R.": {  
      // baseline uses global default  
      "simulation": {  
        "model": "C+O",  
        "params": {  
          "Fixed Amount": 773.34,  
          "Cap": 7063,  
          "Overage Rate": 0.13  
        },  
        "bonusPercent": 2  
      }  
    },  
    "Lisa Barbosa": {  
       // baseline uses global default  
      "simulation": {  
        "model": "C+O",  
         "params": {  
          "Fixed Amount": 633.78,  
          "Cap": 5788,  
          "Overage Rate": 0.13  
        },  
        "bonusPercent": 0  
      }  
    }  
    // Maxime and Elliot use the global simulation default (PW)  
  }  
}

## **8\. Acceptance Criteria**

* The application successfully imports and parses the specified CSV format, correctly handling DD/MM/YYYY dates.  
* All five pricing models (PW, FP, HY, DMR, C+O) and the Bonus modifier are implemented according to the logic in Section 4\.  
* The user can successfully configure individualized Baselines and mixed Simulation scenarios using defaults, overrides, and bonuses.  
* Key financial metrics (Effective Rate, Breakeven Point, Total Savings) are calculated correctly.  
* Key statistical metrics (CV, StdDev, P25, P50/Median, P75) are calculated correctly and displayed in the writer breakdown table.  
* Visualizations render correctly and are interactive.  
* The application runs entirely client-side and is deployable as a static site.