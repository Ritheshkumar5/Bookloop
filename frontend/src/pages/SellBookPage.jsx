import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createBook, getBookById, patchBook } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { getErrorMessage, getFieldErrors } from "../utils/helpers";
import BookForm from "../components/BookForm";
import Loader from "../components/Loader";
import ErrorMessage from "../components/ErrorMessage";

export default function SellBookPage() {
  const { id } = useParams();
  const edit = Boolean(id);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [initial, setInitial] = useState(null);
  const [loading, setLoading] = useState(edit);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (!edit) {
      setInitial({
        title: "", author: "", category: "", subject: "",
        department: user?.department || "", college_name: user?.college_name || "",
        city: user?.city || "", description: "", condition: "", price: "",
        delivery_method: "meet", is_urgent: false, delivery_time: "SAME_DAY", image: null,
      });
      return;
    }
    let active = true;
    getBookById(id).then(({ data }) => {
      if (data.seller_id !== user?.user_id && user?.role !== "admin") {
        navigate("/my-listings", { replace: true });
        return;
      }
      if (active) setInitial({ ...data, image: null, existingImage: data.image_url });
    }).catch((requestError) => {
      if (active) setFormError(getErrorMessage(requestError, "Could not load this listing."));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [edit, id, user, navigate]);

  async function submit(values) {
    setFormError("");
    setFieldErrors({});
    const formData = new FormData();
    [
      "title", "author", "category", "subject", "department", "college_name",
      "city", "description", "condition", "price", "delivery_method",
      "is_urgent", "delivery_time",
    ].forEach((key) => {
      if (values[key] !== undefined && values[key] !== null) formData.append(key, values[key]);
    });
    if (values.image) formData.append("image", values.image);
    setSubmitting(true);
    try {
      if (edit) await patchBook(id, formData);
      else await createBook(formData);
      const resubmitting = edit && initial.status === "rejected";
      navigate("/my-listings", {
        state: {
          message: resubmitting
            ? "Listing resubmitted for admin approval."
            : edit ? "Listing updated." : "Listing submitted! It will appear after admin approval.",
        },
      });
    } catch (requestError) {
      setFieldErrors(getFieldErrors(requestError));
      setFormError(getErrorMessage(requestError, "Could not save your listing."));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !initial) return <main className="container page-space">{formError && !loading ? <ErrorMessage message={formError} /> : <Loader />}</main>;
  return (
    <main className="container narrow page-space">
      <div className="page-heading"><span className="eyebrow">Give good books another chapter</span><h1>{edit ? "Edit your listing" : "Sell a book"}</h1><p className="muted">{edit ? "Keep your details up to date." : "List study material for students across India."}</p></div>
      {formError && <ErrorMessage message={formError} />}
      <BookForm mode={edit ? "edit" : "create"} initialValues={initial} errors={fieldErrors} submitting={submitting} onSubmit={submit} />
    </main>
  );
}
