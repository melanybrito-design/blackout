// Las seis del afiche (personajes ficticios).
export interface Girl {
  id: string;
  name: string;
  code: string;
  dob: string;
  seed: number;
  hair: number;
}

export const GIRLS: Girl[] = [
  { id: 'lucia', name: 'LUCÍA RÍOS', code: 'S01', dob: '12/04/2008', seed: 4011, hair: 0 },
  { id: 'daniela', name: 'DANIELA SOTO', code: 'S02', dob: '03/02/2007', seed: 2203, hair: 1 },
  { id: 'renata', name: 'RENATA CRUZ', code: 'S03', dob: '30/11/2007', seed: 3307, hair: 1 },
  { id: 'anapaula', name: 'ANA PAULA MEJÍA', code: 'S04', dob: '20/12/2006', seed: 5419, hair: 2 },
  { id: 'fernanda', name: 'FERNANDA VIDAL', code: 'S05', dob: '13/10/2007', seed: 6121, hair: 0 },
  { id: 'isabel', name: 'ISABEL ORTEGA', code: 'S06', dob: '13/02/2008', seed: 7333, hair: 1 },
];
