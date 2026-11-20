import { Request } from 'express';

export enum Role {
  University = 'university', // Org1 : émission & signature
  Ministry = 'ministry', // Org2 : audit & supervision
  Recruiter = 'recruiter', // Org3 : vérification en lecture seule
  Student = 'student', // consultation & partage
}

export interface AuthUser {
  sub: string;
  username?: string;
  roles: string[];
  /** Identifiant étudiant (claim Keycloak "student_id"), utilisé pour calculer la référence pseudonymisée. */
  studentId?: string;
}

export interface AuthRequest extends Request {
  user: AuthUser;
}
