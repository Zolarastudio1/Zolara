import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";

interface AvatarUploadProps {
  image: File | string | null; // can be File (live), string (uploaded URL), or null
  onChange: (file: File) => void;
}

export const AvatarUpload: React.FC<AvatarUploadProps> = ({ image, onChange }) => {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!image) {
      setPreview(null);
      return;
    }

    // If it's a File object (live selection), create a preview URL
    if (image instanceof File) {
      const objectUrl = URL.createObjectURL(image);
      setPreview(objectUrl);

      // Revoke object URL on cleanup to avoid memory leaks
      return () => URL.revokeObjectURL(objectUrl);
    }

    // If it's already a URL (uploaded), use it
    if (typeof image === "string") {
      setPreview(image);
    }
  }, [image]);

  return (
    <div className="flex justify-center">
      <label className="cursor-pointer relative w-24 h-24 rounded-full border border-gray-300 overflow-hidden bg-gray-100 flex items-center justify-center">
        {preview ? (
          <img
            src={preview}
            alt="avatar"
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-gray-400">+</span>
        )}

        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files && onChange(e.target.files[0])}
        />

        {/* Edit Icon if image exists */}
        {preview && (
          <div className="absolute bottom-0 right-0 bg-white rounded-full p-1 shadow-md">
            <Pencil className="w-4 h-4 text-gray-600" />
          </div>
        )}
      </label>
    </div>
  );
};
