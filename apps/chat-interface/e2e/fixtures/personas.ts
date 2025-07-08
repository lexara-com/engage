/**
 * Test personas for personal injury chatbot conversations
 */

export interface TestPersona {
  name: string;
  email: string;
  phone: string;
  injuryType: string;
  scenario: {
    date: string;
    description: string;
    location?: string;
    injuries: string[];
    medicalTreatment: string;
    propertyDamage?: string;
    workMissed?: string;
    priorInjuries?: string;
    witnesses?: string;
    photosTaken?: boolean;
    incidentReport?: boolean;
    employerNotified?: boolean;
    workersCompClaim?: string;
    safetyViolations?: string;
  };
}

// Generate unique email for each test run
function generateTestEmail(base: string): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return base.replace('@', `+test${timestamp}${random}@`);
}

export const personas: Record<string, TestPersona> = {
  carAccident: {
    name: "Sarah Thompson",
    email: generateTestEmail("sarah.thompson@example.com"),
    phone: "(555) 123-4567",
    injuryType: "Motor Vehicle Accident",
    scenario: {
      date: "2 weeks ago",
      description: "I was rear-ended at a red light on Highway 101. The other driver was texting and didn't stop in time.",
      injuries: ["Whiplash", "Lower back pain", "Persistent headaches"],
      medicalTreatment: "Went to the ER immediately, currently doing physical therapy twice a week",
      propertyDamage: "$8,500 damage to my 2020 Honda Civic",
      workMissed: "5 days so far, doctor says I need at least 2 more weeks",
      priorInjuries: "No prior neck or back injuries"
    }
  },
  
  slipAndFall: {
    name: "Michael Chen",
    email: generateTestEmail("michael.chen@example.com"),
    phone: "(555) 234-5678",
    injuryType: "Premises Liability",
    scenario: {
      date: "3 weeks ago",
      location: "SaveMart Grocery on Market Street",
      description: "Slipped on an unmarked wet floor near the produce section. No warning signs were posted.",
      injuries: ["Fractured right wrist", "Bruised hip", "Sprained ankle"],
      medicalTreatment: "ER visit, orthopedic surgeon consultation, wearing a cast for 6 weeks",
      witnesses: "Yes, a store employee saw me fall and helped me up",
      photosTaken: true,
      incidentReport: true
    }
  },
  
  workplaceInjury: {
    name: "Emma Rodriguez",
    email: generateTestEmail("emma.rodriguez@example.com"),
    phone: "(555) 345-6789",
    injuryType: "Workplace Accident",
    scenario: {
      date: "1 week ago",
      description: "Part of the scaffolding collapsed while I was working on the third floor of a construction site",
      injuries: ["Mild concussion", "Dislocated shoulder", "Multiple cuts and bruises"],
      medicalTreatment: "Hospitalized for 2 days, ongoing treatment for shoulder",
      employerNotified: true,
      workersCompClaim: "Filed but employer is disputing it",
      safetyViolations: "No hard hats provided, scaffolding wasn't properly secured",
      witnesses: "3 coworkers saw the accident"
    }
  },
  
  dogBite: {
    name: "James Wilson",
    email: generateTestEmail("james.wilson@example.com"),
    phone: "(555) 456-7890",
    injuryType: "Dog Bite",
    scenario: {
      date: "4 days ago",
      location: "Neighbor's front yard on Elm Street",
      description: "Neighbor's German Shepherd attacked me while I was jogging past their house. The dog was not on a leash.",
      injuries: ["Deep bite wounds on left forearm", "Puncture wounds on leg"],
      medicalTreatment: "ER treatment, tetanus shot, antibiotics, may need plastic surgery",
      witnesses: "Another neighbor saw it happen from their window",
      incidentReport: true
    }
  },
  
  medicalMalpractice: {
    name: "Patricia Martinez",
    email: generateTestEmail("patricia.martinez@example.com"),
    phone: "(555) 567-8901",
    injuryType: "Medical Malpractice",
    scenario: {
      date: "2 months ago",
      description: "Surgeon operated on the wrong knee during my scheduled knee replacement surgery",
      location: "St. Mary's Hospital",
      injuries: ["Unnecessary surgical wounds", "Prolonged recovery", "Still need surgery on correct knee"],
      medicalTreatment: "Multiple corrective procedures, physical therapy, pain management",
      workMissed: "3 months and counting",
      priorInjuries: "Only the original knee problem that needed surgery"
    }
  }
};

// Helper to get a random persona for testing
export function getRandomPersona(): TestPersona {
  const keys = Object.keys(personas);
  const randomKey = keys[Math.floor(Math.random() * keys.length)];
  return personas[randomKey];
}

// Helper to get persona by type
export function getPersonaByType(type: keyof typeof personas): TestPersona {
  return personas[type];
}