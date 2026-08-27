import { useState } from "react";

interface SearchBarProps {
  onSearch: (q: string) => Promise<void>;
}

export function SearchBar({ onSearch }: SearchBarProps) {
  const [sentence, setSentence] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await onSearch(sentence);
  };

  return (
    <>
      <h2>Buscar registros</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="search"
          placeholder="Buscar registros..."
          value={sentence}
          onChange={(e) => setSentence(e.target.value)}
        />
        <button type="submit">Buscar</button>
      </form>
    </>
  );
}
