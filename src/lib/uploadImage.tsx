// import { supabase } from "../lib/supabaseClient";

  
//   export const handleUpload = async ({
//     userId,
//     role, // "staff" | "client" | etc.
//     file
//   }: {
//     userId: string;
//     role: string;
//     file: File;
// }) => {
//     if (!file) return;
//     setUploading(true);

//     // Create a unique file name: role-userId-timestamp-originalname
//     const timestamp = Date.now();
//     const fileExtension = file.name.split(".").pop();
//     const fileName = `${role}-${userId}-${timestamp}.${fileExtension}`;

//     try {
//       // Upload to Supabase Storage
//       const { error: uploadError } = await supabase.storage
//         .from("avatars") // bucket name
//         .upload(fileName, file, { cacheControl: "3600", upsert: true });

//       if (uploadError) throw uploadError;

//       // Get public URL
//       const { data: urlData } = supabase.storage
//         .from("avatars")
//         .getPublicUrl(fileName);

//       // Update DB with URL
//       const { error: dbError } = await supabase
//         .from("users")
//         .update({ avatar_url: urlData.publicUrl })
//         .eq("id", userId);

//       if (dbError) throw dbError;

//       alert("Image uploaded successfully!");
//     } catch (err) {
//       console.error("Upload failed:", err);
//       alert("Upload failed, check console");
//     } finally {
//       setUploading(false);
//     }
//   };