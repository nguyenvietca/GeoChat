package com.geochat.chat.service;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.multipart.MultipartFile;
import javax.imageio.ImageIO;
import javax.imageio.stream.MemoryCacheImageInputStream;
import java.nio.file.*;
import java.io.*;
import java.util.*;
@Service
public class ImageStorage {
 private final Path root;
 private final long maxSize;
 private final Set<String> allowed;
 public record Stored(String key,String filename,String contentType,long size,int width,int height) {}
 public ImageStorage(@Value("${geochat.upload.storage-path:./var/chat-images}") String path,
   @Value("${geochat.upload.max-image-size:5242880}") long max,
   @Value("${geochat.upload.allowed-types:image/jpeg,image/png,image/webp}") String types) {
  root=Path.of(path).toAbsolutePath().normalize();maxSize=Math.min(max,5242880);allowed=new HashSet<>(Arrays.asList(types.split(",")));
  try { Files.createDirectories(root); } catch(IOException ex){throw new IllegalStateException("Image storage unavailable");}
 }
 // Serialize bounded decoding: at most one image buffer per storage instance.
 public synchronized Stored store(MultipartFile file) {
  if(file==null || file.isEmpty()) throw new IllegalArgumentException("Select a non-empty image");
  if(file.getSize()>maxSize) throw new IllegalArgumentException("Image must be at most 5 MB");
  String mime=file.getContentType();
  if(!Set.of("image/jpeg","image/png","image/webp").contains(mime==null?"":mime)||!allowed.contains(mime)) throw new IllegalArgumentException("Only JPEG, PNG and WebP images are supported");
  try {
   byte[] bytes=file.getBytes();
   if(bytes.length>maxSize) throw new IllegalArgumentException("Image must be at most 5 MB");
   try(var input=new MemoryCacheImageInputStream(new ByteArrayInputStream(bytes))) {
    var readers=ImageIO.getImageReaders(input);
    if(!readers.hasNext()) throw new IllegalArgumentException("Invalid image data");
    var reader=readers.next();
    try {
     reader.setInput(input,true,true);
     String format=reader.getFormatName().toLowerCase(Locale.ROOT);
     String actual=switch(format){case "jpeg","jpg"->"image/jpeg";case "png"->"image/png";case "webp"->"image/webp";default->"";};
     if(!mime.equals(actual)) throw new IllegalArgumentException("Image content does not match its type");
     if(format.equals("webp") && bytes.length>20 && bytes[12]=='V' && bytes[13]=='P' && bytes[14]=='8' && bytes[15]=='X' && (bytes[20]&2)!=0) throw new IllegalArgumentException("Animated images are not supported");
     int width=reader.getWidth(0),height=reader.getHeight(0);
     if(width<1||height<1||width>4096||height>4096||(long)width*height>12000000) throw new IllegalArgumentException("Image dimensions exceed 4096 px or 12 megapixels");
     var image=reader.read(0);
     if(image==null) throw new IllegalArgumentException("Invalid image data");
     var output=new ByteArrayOutputStream();
     String encoding=mime.equals("image/jpeg")?"jpeg":"png";
     if(!ImageIO.write(image,encoding,output)) throw new IllegalArgumentException("Cannot process image");
     image.flush();
     if(output.size()>maxSize) throw new IllegalArgumentException("Processed image exceeds 5 MB; choose a smaller image");
     String key=UUID.randomUUID()+"."+encoding;
     Files.write(resolve(key),output.toByteArray(),StandardOpenOption.CREATE_NEW);
     String name=Objects.toString(file.getOriginalFilename(),"Photo").replace((char)92,'_').replaceAll("[/\\p{Cntrl}]","_");
     return new Stored(key,name.substring(0,Math.min(name.length(),160)),"image/"+encoding,output.size(),width,height);
    } finally {reader.dispose();}
   }
  } catch(IOException ex){throw new IllegalArgumentException("Unable to process image");}
 }
 public Path resolve(String key) {
  if(key==null||!key.matches("[a-f0-9-]{36}\\.(png|jpeg)")) throw new IllegalArgumentException("Invalid image key");
  Path path=root.resolve(key).normalize();
  if(!path.getParent().equals(root)||Files.isSymbolicLink(path)) throw new IllegalArgumentException("Invalid image key");
  return path;
 }
 public byte[] read(String key) {
  try{return Files.readAllBytes(resolve(key));}catch(IOException ex){throw new jakarta.persistence.EntityNotFoundException("Image unavailable");}
 }
 public void delete(String key) {try{Files.deleteIfExists(resolve(key));}catch(IOException ex){throw new IllegalStateException("Image cleanup deferred");}}
 public List<Path> files() {try(var stream=Files.list(root)){return stream.filter(path->Files.isRegularFile(path,LinkOption.NOFOLLOW_LINKS)).toList();}catch(IOException ex){return List.of();}}
}
