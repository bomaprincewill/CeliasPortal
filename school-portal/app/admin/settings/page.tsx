"use client";
import { useEffect, useState } from "react";
import { Settings, School, Calendar, Shield, Bell, Save, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { Toast } from "@/components/ui";
import { getSchoolSettings, saveSchoolSettings } from "@/actions/settings/manageSettings";

export default function SettingsPage() {
  const [toast, setToast]   = useState<any>(null);
  const [saved, setSaved]   = useState(false);
  const [loading, setLoading] = useState(true);

  const [school, setSchool] = useState({
    name:    "Model Primary & Secondary School",
    address: "14 Education Road, Lagos State, Nigeria",
    motto:   "Excellence Through Knowledge",
    phone:   "+234 800 000 0000",
    email:   "info@school.edu",
    website: "www.school.edu",
  });

  const [sessions, setSessions] = useState([
    { id:"s1", name:"2024/2025", isCurrent:false },
    { id:"s2", name:"2025/2026", isCurrent:true  },
  ]);

  const [grading, setGrading] = useState([
    { grade:"A", min:75, max:100, remark:"Distinction" },
    { grade:"B", min:65, max:74,  remark:"Credit"      },
    { grade:"C", min:55, max:64,  remark:"Merit"       },
    { grade:"D", min:45, max:54,  remark:"Pass"        },
    { grade:"E", min:40, max:44,  remark:"Weak Pass"   },
    { grade:"F", min:0,  max:39,  remark:"Fail"        },
  ]);

  const [scoreConfig, setScoreConfig] = useState({ maxCA1:10, maxCA2:10, maxCA3:10, maxExam:70 });

  useEffect(() => {
    getSchoolSettings()
      .then(data => { setSchool(data.school); setSessions(data.sessions); setGrading(data.grading); setScoreConfig(data.scoreConfig); })
      .catch(() => setToast({ type:"error", message:"Settings could not be loaded." }))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      const result = await saveSchoolSettings({ school, sessions, grading, scoreConfig });
      if (!result.success) return setToast({ type:"error", message:result.error ?? "Settings could not be saved." });
      setSaved(true);
      setToast({ type:"success", message:"Settings saved successfully." });
      const fresh = await getSchoolSettings();
      setSessions(fresh.sessions);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setToast({ type:"error", message:"Settings could not be saved." });
    } finally { setLoading(false); }
  };

  const setCurrentSession = (id: string) =>
    setSessions(prev => prev.map(s => ({ ...s, isCurrent: s.id === id })));

  return (
    <div className="max-w-3xl space-y-8">
      {toast && <Toast {...toast} onClose={() => setToast(null)}/>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="page-header mb-0">
          <h1 className="page-title flex items-center gap-2"><Settings className="w-6 h-6 text-brand-600"/>Settings</h1>
          <p className="page-subtitle">Configure your school portal</p>
        </div>
        <button onClick={handleSave} disabled={loading} className="btn-primary gap-2">
          {saved ? <><CheckCircle2 className="w-4 h-4"/>Saved!</> : <><Save className="w-4 h-4"/>Save All</>}
        </button>
      </div>

      {/* School info */}
      <div className="card">
        <div className="px-5 py-4 border-b border-border flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center"><School className="w-4 h-4 text-brand-600"/></div>
          <h2 className="font-semibold text-ink">School Information</h2>
        </div>
        <div className="px-5 py-4 grid grid-cols-2 gap-4">
          {[
            ["School Name",    "name",    "Model Primary & Secondary School"],
            ["Address",        "address", "14 Education Road, Lagos"],
            ["Motto",          "motto",   "Excellence Through Knowledge"],
            ["Phone",          "phone",   "+234 800 000 0000"],
            ["Email",          "email",   "info@school.edu"],
            ["Website",        "website", "www.school.edu"],
          ].map(([label, key, placeholder]) => (
            <div key={key} className={`form-group ${key === "address" || key === "motto" ? "col-span-2" : ""}`}>
              <label className="label">{label}</label>
              <input value={(school as any)[key]} onChange={e => setSchool(s => ({...s, [key]:e.target.value}))}
                className="input" placeholder={placeholder}/>
            </div>
          ))}
        </div>
      </div>

      {/* Academic sessions */}
      <div className="card">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center"><Calendar className="w-4 h-4 text-brand-600"/></div>
            <h2 className="font-semibold text-ink">Academic Sessions</h2>
          </div>
          <button onClick={() => setSessions(p => [...p, { id:`new_${Date.now()}`, name:"", isCurrent:false }])} className="btn-secondary btn-sm gap-1">
            <Plus className="w-3.5 h-3.5"/> Add
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {sessions.map(s => (
            <div key={s.id} className="flex items-center gap-3">
              <input value={s.name} onChange={e => setSessions(p => p.map(x => x.id===s.id ? {...x, name:e.target.value} : x))}
                className="input flex-1" placeholder="e.g. 2025/2026"/>
              <button onClick={() => setCurrentSession(s.id)}
                className={`btn-sm border-2 font-semibold text-xs rounded-full px-3 transition-all ${s.isCurrent ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-border text-muted hover:border-emerald-300"}`}>
                {s.isCurrent ? "✓ Current" : "Set Current"}
              </button>
              {s.id.startsWith("new_") && <button onClick={() => setSessions(p => p.filter(x => x.id !== s.id))} className="btn-ghost btn-icon btn-sm hover:text-danger" aria-label="Remove unsaved session">
                <Trash2 className="w-3.5 h-3.5"/>
              </button>}
            </div>
          ))}
        </div>
      </div>

      {/* Score configuration */}
      <div className="card">
        <div className="px-5 py-4 border-b border-border flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center"><Shield className="w-4 h-4 text-brand-600"/></div>
          <div>
            <h2 className="font-semibold text-ink">Score Configuration</h2>
            <p className="text-xs text-muted">Total: {scoreConfig.maxCA1 + scoreConfig.maxCA2 + scoreConfig.maxCA3 + scoreConfig.maxExam} marks</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 px-4 py-4 sm:px-5 lg:grid-cols-4">
          {[["CA 1 Max","maxCA1"],["CA 2 Max","maxCA2"],["CA 3 Max","maxCA3"],["Exam Max","maxExam"]].map(([label, key]) => (
            <div key={key} className="form-group">
              <label className="label">{label}</label>
              <input type="number" min={0} max={100}
                value={(scoreConfig as any)[key]}
                onChange={e => setScoreConfig(c => ({...c, [key]:parseInt(e.target.value)||0}))}
                className="input text-center font-mono"/>
            </div>
          ))}
        </div>
      </div>

      {/* Grading scale */}
      <div className="card">
        <div className="px-5 py-4 border-b border-border flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center"><Bell className="w-4 h-4 text-brand-600"/></div>
          <h2 className="font-semibold text-ink">Grading Scale</h2>
        </div>
        <div className="px-5 py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th className="text-left pb-2">Grade</th><th className="text-left pb-2">Min</th><th className="text-left pb-2">Max</th><th className="text-left pb-2">Remark</th>
              </tr>
            </thead>
            <tbody className="space-y-2">
              {grading.map((g, i) => (
                <tr key={g.grade} className="border-b border-border last:border-0">
                  <td className="py-2"><span className="font-bold text-brand-600 font-mono">{g.grade}</span></td>
                  <td className="py-2">
                    <input type="number" value={g.min} onChange={e => setGrading(p => p.map((x,j)=>j===i?{...x,min:+e.target.value}:x))}
                      className="input w-20 text-center font-mono text-sm py-1"/>
                  </td>
                  <td className="py-2">
                    <input type="number" value={g.max} onChange={e => setGrading(p => p.map((x,j)=>j===i?{...x,max:+e.target.value}:x))}
                      className="input w-20 text-center font-mono text-sm py-1"/>
                  </td>
                  <td className="py-2">
                    <input value={g.remark} onChange={e => setGrading(p => p.map((x,j)=>j===i?{...x,remark:e.target.value}:x))}
                      className="input text-sm py-1"/>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
