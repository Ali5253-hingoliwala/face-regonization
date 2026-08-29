import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { api } from "../api/client";

type Role = "admin" | "student";
type Theme = "light" | "dark";
interface AuthState { token: string | null; role: Role | null; name: string | null; studentId: string | null; }
interface GoogleResult { onboardingRequired: boolean; email?: string; suggestedName?: string; role?: Role; }
interface LoginResult { requires2FA: boolean; role?: Role; challenge?: string; maskedEmail?: string; }
interface AuthContextValue extends AuthState { isAuthenticated:boolean; authReady:boolean; theme:Theme; toggleTheme:()=>void; login:(username:string,password:string,captchaToken:string)=>Promise<LoginResult>; verify2FA:(challenge:string,code:string)=>Promise<Role>; signup:(studentId:string,name:string,password:string,faceImage:string,email:string,gender:string)=>Promise<void>; googleLogin:(credential:string)=>Promise<GoogleResult>; googleOnboard:(credential:string,data:{username:string;studentId:string;password:string;gender:string;faceImage:string})=>Promise<Role>; logout:()=>void; }
const AuthContext=createContext<AuthContextValue|undefined>(undefined);
function persistAuth(response:any){const {access_token,role,name,student_id}=response.data??response;localStorage.setItem("va_token",access_token);localStorage.setItem("va_role",role);if(name)localStorage.setItem("va_name",name);else localStorage.removeItem("va_name");if(student_id)localStorage.setItem("va_student_id",student_id);else localStorage.removeItem("va_student_id");return {token:access_token,role:role as Role,name:name??null,studentId:student_id??null};}
export function AuthProvider({children}:{children:ReactNode}){
 const[state,setState]=useState<AuthState>({token:null,role:null,name:null,studentId:null});const[authReady,setAuthReady]=useState(false);const[theme,setTheme]=useState<Theme>(()=>(localStorage.getItem("va_theme") as Theme)||"light");
 useEffect(()=>{document.documentElement.classList.toggle("dark",theme==="dark");localStorage.setItem("va_theme",theme)},[theme]);
 useEffect(()=>{const token=localStorage.getItem("va_token"),role=localStorage.getItem("va_role") as Role|null,name=localStorage.getItem("va_name"),studentId=localStorage.getItem("va_student_id");if(token&&role)setState({token,role,name,studentId});setAuthReady(true)},[]);
 async function login(username:string,password:string,captchaToken:string):Promise<LoginResult>{const response=await api.post("/auth/login",{username,password,captcha_token:captchaToken});if(response.data?.requires_2fa)return{requires2FA:true,challenge:response.data.challenge,maskedEmail:response.data.masked_email};const next=persistAuth(response);setState(next);return{requires2FA:false,role:next.role};}
 async function verify2FA(challenge:string,code:string):Promise<Role>{const response=await api.post("/auth/2fa/verify",{code},{params:{challenge}});const next=persistAuth(response);setState(next);return next.role;}
 async function signup(studentId:string,name:string,password:string,faceImage:string,email:string,gender:string){await api.post("/auth/signup",{student_id:studentId,name,email,password,gender,face_image:faceImage});}
 async function googleLogin(credential:string):Promise<GoogleResult>{const response=await api.post("/auth/google",{credential});if(response.data?.onboarding_required)return{onboardingRequired:true,email:response.data.email,suggestedName:response.data.suggested_name};const next=persistAuth(response);setState(next);return{onboardingRequired:false,role:next.role};}
 async function googleOnboard(credential:string,data:{username:string;studentId:string;password:string;gender:string;faceImage:string}):Promise<Role>{const response=await api.post("/auth/google",{credential,username:data.username,student_id:data.studentId,password:data.password,gender:data.gender,face_image:data.faceImage});const next=persistAuth(response);setState(next);return next.role;}
 function logout(){localStorage.removeItem("va_token");localStorage.removeItem("va_role");localStorage.removeItem("va_name");localStorage.removeItem("va_student_id");setState({token:null,role:null,name:null,studentId:null});}
 return <AuthContext.Provider value={{...state,isAuthenticated:!!state.token,authReady,theme,toggleTheme:()=>setTheme(t=>t==="light"?"dark":"light"),login,verify2FA,signup,googleLogin,googleOnboard,logout}}>{children}</AuthContext.Provider>;
}
export function useAuth(){const ctx=useContext(AuthContext);if(!ctx)throw new Error("useAuth must be used within an AuthProvider");return ctx;}
