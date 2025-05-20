import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy } from "lucide-react";

export default function Scoreboard() {
  const [usuarios, setUsuarios] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/usuarios/top")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => setUsuarios(data))
      .catch((err) => {
        console.error("Error al cargar usuarios:", err);
        setError("No se pudieron cargar los usuarios.");
      });
  }, []);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-4xl font-bold text-center mb-6 flex justify-center items-center gap-2">
        <Trophy className="text-yellow-400" /> Scoreboard
      </h1>
      {error ? (
        <div className="text-red-500 text-center mb-4">{error}</div>
      ) : (
        <div className="bg-gray-900 rounded-2xl shadow-lg p-4">
          <table className="w-full text-left text-white">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="py-2 px-4">#</th>
                <th className="py-2 px-4">Usuario</th>
                <th className="py-2 px-4">Balance</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((usuario, index) => (
                <tr
                  key={usuario.id}
                  className={
                    index % 2 === 0 ? "bg-gray-800" : "bg-gray-700"
                  }
                >
                  <td className="py-2 px-4 font-bold text-yellow-400">{index + 1}</td>
                  <td className="py-2 px-4">{usuario.nombre}</td>
                  <td className="py-2 px-4">${usuario.balance.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
