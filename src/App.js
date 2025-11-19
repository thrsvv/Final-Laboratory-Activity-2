import React, { useState, useEffect } from "react";
import * as tf from "@tensorflow/tfjs";
import "./App.css";


const fetchProductsAPI = () => {
  return new Promise((resolve) => {
    const categories = ["Lipstick", "Foundation", "Mascara", "Eyeliner", "Blush", "Eyeshadow", "Serum", "Primer"];
    const types = ["Matte", "Glossy", "Hydrating", "Long-wear", "Satin", "Waterproof", "Sheer", "Velvet"];
    const shades = ["Red", "Nude", "Berry", "Coral", "Ivory", "Mocha", "Pink", "Clear"];

    const products = [];
    for (let i = 1; i <= 100; i++) {
      const cat = categories[Math.floor(Math.random() * categories.length)];
      const type = types[Math.floor(Math.random() * types.length)];
      const shade = shades[Math.floor(Math.random() * shades.length)];
      
      
      const avgSales = Math.floor(Math.random() * 40) + 5; 
      const leadTime = Math.floor(Math.random() * 14) + 2; 
      
      
      const needsReorder = Math.random() > 0.6; 
      let stock;
      
      if (needsReorder) {
    
        stock = Math.floor(Math.random() * avgSales * 0.5); 
      } else {

        stock = Math.floor(Math.random() * avgSales * 3) + avgSales;
      }

      products.push({
        id: i,
        name: `${type} ${cat} (${shade})`,
        stock: stock,
        avgSales: avgSales,
        leadTime: leadTime,
      });
    }
    setTimeout(() => resolve(products), 800);
  });
};

export default function InventoryPredictor() {
  const [products, setProducts] = useState([]);
  const [predictions, setPredictions] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [modelStatus, setModelStatus] = useState("Ready to Load");
  const [reorderCount, setReorderCount] = useState(0);

  const handleProcessData = async () => {
    setIsLoading(true);
    setModelStatus("Fetching Inventory...");

  
    const fetchedProducts = await fetchProductsAPI();
    setProducts(fetchedProducts);

    setModelStatus("Calibrating System...");

    const trainInputs = [
        [10, 50, 5],  
        [200, 10, 7], 
        [5, 20, 10], 
        [50, 10, 2], 
        [0, 50, 3],  
        [15, 15, 14],
    ];
    const trainLabels = [[1], [0], [1], [0], [1], [1]];

    const trainingData = tf.tensor2d(trainInputs);
    const outputData = tf.tensor2d(trainLabels);

    const model = tf.sequential();
    model.add(tf.layers.dense({ inputShape: [3], units: 12, activation: "relu" }));
    model.add(tf.layers.dense({ units: 1, activation: "sigmoid" }));

    model.compile({ optimizer: "adam", loss: "binaryCrossentropy", metrics: ["accuracy"] });

    await model.fit(trainingData, outputData, { epochs: 150, shuffle: true });

    setModelStatus("Analyzing Stock...");

    
    const productInputs = fetchedProducts.map(p => [p.stock, p.avgSales, p.leadTime]);
    const inputTensor = tf.tensor2d(productInputs);
    const results = model.predict(inputTensor);
    const values = await results.data();

    const newPredictions = {};
    let count = 0;

    fetchedProducts.forEach((p, index) => {
      const score = values[index];
      const isReorder = score > 0.5;
      if (isReorder) count++;
      newPredictions[p.id] = {
        action: isReorder ? "Reorder" : "Hold",
        score: score.toFixed(3)
      };
    });

    setPredictions(newPredictions);
    setReorderCount(count);
    setModelStatus("Analysis Complete");
    setIsLoading(false);
    
    trainingData.dispose();
    outputData.dispose();
    inputTensor.dispose();
  };

  return (
    <div className="app-container">
      <header className="dashboard-header">
        <div className="logo-section">
          <h1>Makeup Inventory Forecast</h1>
          <p>TensorFlow.js Model Prediction Dashboard</p>
        </div>
        <div className="control-section">
           <button 
            className="primary-btn" 
            onClick={handleProcessData} 
            disabled={isLoading}
          >
            {isLoading ? "Generating Forecast..." : "Run Forecast Analysis"}
          </button>
        </div>
      </header>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Products</h3>
          <div className="stat-value">{products.length > 0 ? products.length : "-"}</div>
        </div>
        <div className="stat-card highlight">
          <h3>Immediate Reorder Needed</h3>
          <div className="stat-value text-red">{reorderCount > 0 ? reorderCount : "-"}</div>
        </div>
        <div className="stat-card">
          <h3>System Status</h3>
          <div className="stat-value text-green status-text">{modelStatus}</div>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Product Name</th>
              <th>Inventory (Units)</th>
              <th>Avg Sales/Wk</th>
              <th>Lead Time</th>
              <th>Days of Supply</th>
              <th>Safety Stock</th>
              <th>Prediction</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr><td colSpan="7" className="empty-state">No data. Click 'Run Forecast Analysis' to begin.</td></tr>
            ) : (
              products.map((p) => {
                const pred = predictions[p.id];
                const isReorder = pred?.action === "Reorder";
      
                const daysSupply = ((p.stock / (p.avgSales / 7)) || 0).toFixed(1);
                const safetyStock = Math.floor(p.avgSales * (p.leadTime / 7) * 1.5); 

                return (
                  <tr key={p.id} className={isReorder ? "row-reorder" : "row-hold"}>
                    <td className="product-name">{p.name}</td>
                    <td className={isReorder ? "text-bold-red" : "text-bold-green"}>{p.stock} units</td>
                    <td>{p.avgSales} / wk</td>
                    <td>{p.leadTime} days</td>
                    <td>{daysSupply} days</td>
                    <td>{safetyStock} units</td>
                    <td>
                      {pred ? (
                        <span className={`badge ${isReorder ? "badge-red" : "badge-green"}`}>
                          {isReorder ? "⚠ Reorder" : "✔ Hold"} <small>({pred.score})</small>
                        </span>
                      ) : "..."}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}