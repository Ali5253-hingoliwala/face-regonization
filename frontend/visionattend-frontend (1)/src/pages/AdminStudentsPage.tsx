import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Plus, Search, Trash2, Users, X } from "lucide-react";
import AdminSidebar from "../components/AdminSidebar";
import { api } from "../api/client";

type Student = { student_id: string; name: string };

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");
  const [faceImage, setFaceImage] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  async function load() {
    try {
      const response = await api.get("/students");
      setStudents(response.data.students ?? []);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    void load();
    return () => streamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  async function openCamera() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
    } catch {
      setError("Camera permission was denied or the camera is unavailable.");
    }
  }

  function closeCamera() {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }

  function captureFace() {
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      setError("Camera is not ready yet.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    setFaceImage(canvas.toDataURL("image/jpeg", 0.88));
    closeCamera();
  }

  async function addStudent() {
    setError("");
    setMessage("");
    if (!studentId.trim() || !name.trim() || !faceImage) {
      setError("Student ID, name and a face capture are required.");
      return;
    }

    setSaving(true);
    try {
      await api.post("/students", {
        student_id: studentId.trim(),
        name: name.trim(),
        face_image: faceImage,
      });
      setMessage("Student and face embedding registered successfully.");
      setStudentId("");
      setName("");
      setFaceImage("");
      setShowAdd(false);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Could not register student.");
    } finally {
      setSaving(false);
    }
  }

  async function removeStudent(student: Student) {
    if (!window.confirm(`Delete ${student.name} (${student.student_id})? Their attendance history will be preserved.`)) return;
    try {
      await api.delete(`/students/${student.student_id}`);
      setMessage(`${student.name} was removed from the active student registry.`);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Could not delete student.");
    }
  }

  const filtered = students.filter(s => `${s.name} ${s.student_id}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="min-h-screen bg-bg text-ink">
      <AdminSidebar />
      <div className="lg:pl-64">
        <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">Admin Portal</p>
              <h1 className="mt-1 font-display text-3xl font-semibold">Students</h1>
              <p className="mt-2 text-sm text-ink-muted">Manage the common VisionAttend face registry.</p>
            </div>
            <button onClick={() => { setShowAdd(true); setError(""); }} className="flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-medium text-white"><Plus size={17}/> Add Student</button>
          </div>

          {message && <p className="mt-5 flex items-center gap-2 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700"><CheckCircle2 size={17}/>{message}</p>}
          {error && !showAdd && <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

          <div className="mt-6 rounded-2xl border border-line bg-panel p-5 shadow-sm">
            <div className="relative"><Search className="absolute left-3 top-3 text-ink-faint" size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search students..." className="w-full rounded-xl border border-line bg-bg py-2.5 pl-10 pr-4 outline-none focus:border-accent"/></div>
            <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-line bg-panel-hover text-xs uppercase tracking-wider text-ink-faint"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Student ID</th><th className="px-4 py-3">Face</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody>{filtered.map(s => <tr key={s.student_id} className="border-b border-line last:border-0"><td className="px-4 py-4 font-medium">{s.name}</td><td className="px-4 py-4 font-mono text-xs text-ink-muted">{s.student_id}</td><td className="px-4 py-4"><span className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-xs text-accent"><Users size={13}/> Registered</span></td><td className="px-4 py-4 text-right"><button onClick={() => removeStudent(s)} className="rounded-lg p-2 text-ink-muted hover:bg-red-50 hover:text-red-600" title="Delete student"><Trash2 size={17}/></button></td></tr>)}{!filtered.length&&<tr><td colSpan={4} className="px-4 py-12 text-center text-ink-muted">No students found.</td></tr>}</tbody></table></div>
          </div>
        </main>
      </div>

      {showAdd && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 p-4"><div className="w-full max-w-lg rounded-2xl border border-line bg-panel p-6 shadow-2xl"><div className="flex items-center justify-between"><div><h2 className="text-xl font-semibold">Add Student</h2><p className="mt-1 text-sm text-ink-muted">Capture one face and save its embedding to Atlas.</p></div><button onClick={() => { closeCamera(); setShowAdd(false); }} className="rounded-lg p-2 hover:bg-panel-hover"><X size={19}/></button></div>
        <div className="mt-5 space-y-4">
          <input value={studentId} onChange={e => setStudentId(e.target.value)} placeholder="Student ID" className="w-full rounded-xl border border-line bg-bg px-4 py-3 outline-none focus:border-accent"/>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className="w-full rounded-xl border border-line bg-bg px-4 py-3 outline-none focus:border-accent"/>
          {faceImage ? <div className="flex items-center justify-between rounded-xl bg-green-50 p-3 text-sm text-green-700"><span className="flex items-center gap-2"><CheckCircle2 size={17}/> Face captured</span><button onClick={() => setFaceImage("")} className="text-xs hover:underline">Retake</button></div> : <button onClick={openCamera} className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-bg py-3 text-sm font-medium hover:border-accent hover:text-accent"><Camera size={17}/> Open camera</button>}
          {cameraOpen && <div className="rounded-xl bg-black p-2"><video ref={videoRef} autoPlay playsInline muted className="aspect-video w-full rounded-lg object-cover"/><div className="flex gap-2 pt-2"><button onClick={captureFace} className="flex-1 rounded-lg bg-accent py-2.5 text-sm font-medium text-white">Capture</button><button onClick={closeCamera} className="rounded-lg bg-white px-4 py-2.5 text-sm">Close</button></div></div>}
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <button onClick={addStudent} disabled={saving || cameraOpen} className="w-full rounded-xl bg-accent py-3 font-medium text-white disabled:opacity-50">{saving ? "Registering face..." : "Register Student"}</button>
        </div>
      </div></div>}
    </div>
  );
}
