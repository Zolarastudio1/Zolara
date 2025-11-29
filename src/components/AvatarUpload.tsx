import React, { useRef } from "react";
import { FaEdit } from "react-icons/fa"; // npm install react-icons

export default function AvatarUpload({
  image,
  onChange,
}: {
  image: File | null;
  onChange: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  return (
    <div className="flex justify-center mb-4">
      <div className="relative inline-block">
        {/* Avatar Circle */}
        <div
          onClick={handleClick}
          className="w-24 h-24 rounded-full border border-gray-300 overflow-hidden cursor-pointer flex items-center justify-center bg-gray-100"
        >
          {image ? (
            <img
              src={URL.createObjectURL(image)}
              alt="avatar"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-gray-400">Add Image</span>
          )}

          {/* Edit Icon if image exists */}
          {image && (
            <div className="absolute bottom-0 right-0 bg-white rounded-full p-1 shadow-md">
              <FaEdit className="text-gray-600 w-4 h-4" />
            </div>
          )}
        </div>

        {/* Hidden File Input */}
        <input
          type="file"
          accept="image/*"
          ref={inputRef}
          className="hidden"
          onChange={(e) => e.target.files && onChange(e.target.files[0])}
        />
      </div>
    </div>
  );
}
